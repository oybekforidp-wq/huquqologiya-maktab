-- To'lov: guruhdagi birinchi dars tekin, qolganlari faqat to'lov muddati amal qilayotgan o'quvchiga ochiq
alter table enrollments add column if not exists paid_until date;

-- Video va yozuv havolalari alohida jadvalda (yopiq darsda o'quvchiga ko'rinmasin)
create table if not exists lesson_links (
  lesson_id uuid primary key references lessons(id) on delete cascade,
  meeting_url text,
  recording_url text
);
insert into lesson_links (lesson_id, meeting_url, recording_url)
  select id, meeting_url, recording_url from lessons where meeting_url is not null or recording_url is not null
  on conflict (lesson_id) do nothing;
alter table lessons drop column if exists meeting_url;
alter table lessons drop column if exists recording_url;

create or replace function public.has_paid(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments e where e.group_id = gid and e.student_id = auth.uid()
    and e.paid_until is not null and e.paid_until >= (now() at time zone 'Asia/Tashkent')::date)
$$;

create or replace function public.is_free_lesson(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select l.id = (select f.id from lessons f where f.group_id = l.group_id order by f.starts_at, f.created_at, f.id limit 1)
  from lessons l where l.id = lid
$$;

create or replace function public.lesson_open(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when lid is null then false else
    public.teaches(public.lesson_group(lid)) or (public.member_of(public.lesson_group(lid))
      and (public.is_free_lesson(lid) or public.has_paid(public.lesson_group(lid)))) end
$$;

create or replace function public.assignment_open(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.teaches(a.group_id) or (public.member_of(a.group_id)
    and (public.has_paid(a.group_id) or (a.lesson_id is not null and public.is_free_lesson(a.lesson_id))))
  from assignments a where a.id = aid
$$;

grant execute on function public.has_paid(uuid), public.is_free_lesson(uuid), public.lesson_open(uuid), public.assignment_open(uuid) to authenticated;

alter table lesson_links enable row level security;
grant select, insert, update, delete on lesson_links to authenticated;
drop policy if exists p_links_read on lesson_links;
create policy p_links_read on lesson_links for select using (public.lesson_open(lesson_id));
drop policy if exists p_links_write on lesson_links;
create policy p_links_write on lesson_links for all using (public.teaches(public.lesson_group(lesson_id))) with check (public.teaches(public.lesson_group(lesson_id)));

drop policy if exists p_board_read on board_pages;
create policy p_board_read on board_pages for select using (public.lesson_open(lesson_id));
drop policy if exists p_files_read on lesson_files;
create policy p_files_read on lesson_files for select using (public.lesson_open(lesson_id));
drop policy if exists p_asg_student on assignments;
create policy p_asg_student on assignments for select using (public.assignment_open(id));
drop policy if exists p_sub_insert on submissions;
create policy p_sub_insert on submissions for insert with check (
  student_id = auth.uid() and public.assignment_open(assignment_id)
  and (select kind from assignments where id = assignment_id) <> 'test');

drop policy if exists s_read on storage.objects;
create policy s_read on storage.objects for select using (
  bucket_id = 'maktab' and (
    (split_part(name, '/', 1) <> 'sub' and public.lesson_open(split_part(name, '/', 1)::uuid))
    or (split_part(name, '/', 1) = 'sub' and (split_part(name, '/', 3) = auth.uid()::text
        or public.teaches(public.assignment_group(split_part(name, '/', 2)::uuid))))
  ));
drop policy if exists s_write on storage.objects;
create policy s_write on storage.objects for insert with check (
  bucket_id = 'maktab' and (
    (split_part(name, '/', 1) <> 'sub' and public.teaches(public.lesson_group(split_part(name, '/', 1)::uuid)))
    or (split_part(name, '/', 1) = 'sub' and split_part(name, '/', 3) = auth.uid()::text
        and public.assignment_open(split_part(name, '/', 2)::uuid))
  ));

create or replace function public.submit_test(p_assignment uuid, p_answers jsonb) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  a assignments;
  total int; right_count int := 0; i int; s numeric;
begin
  select * into a from assignments where id = p_assignment;
  if a.id is null or a.kind <> 'test' then raise exception 'Vazifa topilmadi'; end if;
  if not public.assignment_open(a.id) then raise exception 'Bu vazifa to''lovdan keyin ochiladi'; end if;
  total := jsonb_array_length(a.questions);
  for i in 0 .. total - 1 loop
    if (p_answers->>i::text) is not null and (p_answers->>i::text)::int = (a.questions->i->>'c')::int then
      right_count := right_count + 1;
    end if;
  end loop;
  s := case when total = 0 then 0 else round(right_count::numeric * a.max_score / total, 1) end;
  insert into submissions (assignment_id, student_id, answers, auto_score, score, graded_at)
  values (a.id, auth.uid(), p_answers, s, s, now())
  on conflict (assignment_id, student_id) do update
    set answers = excluded.answers, auto_score = excluded.auto_score,
        score = excluded.score, submitted_at = now(), graded_at = now();
  return s;
end $$;

create or replace function public.assignment_for_student(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a assignments; done boolean;
begin
  select * into a from assignments where id = p_assignment;
  if a.id is null or not public.assignment_open(a.id) then return null; end if;
  done := exists (select 1 from submissions where assignment_id = a.id and student_id = auth.uid());
  return jsonb_build_object(
    'id', a.id, 'title', a.title, 'kind', a.kind, 'instructions', a.instructions,
    'due_at', a.due_at, 'max_score', a.max_score, 'group_id', a.group_id,
    'questions', case when done or public.teaches(a.group_id) then a.questions
      else (select coalesce(jsonb_agg(q - 'c' - 'a'), '[]'::jsonb) from jsonb_array_elements(a.questions) q) end
  );
end $$;

create or replace function public.join_lesson(p_lesson uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l lessons;
begin
  select * into l from lessons where id = p_lesson;
  if l.id is null or not public.lesson_open(l.id) then return; end if;
  if public.teaches(l.group_id) then return; end if;
  insert into attendance (lesson_id, student_id, status)
  values (l.id, auth.uid(), case when now() > l.starts_at + interval '10 minutes' then 'late'::attendance_status else 'present'::attendance_status end)
  on conflict (lesson_id, student_id) do nothing;
end $$;

-- O'quvchi uchun: guruhdagi tekin dars va to'lov muddati
create or replace function public.group_access(gid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'free_lesson', (select f.id from lessons f where f.group_id = gid order by f.starts_at, f.created_at, f.id limit 1),
    'paid_until', (select paid_until from enrollments where group_id = gid and student_id = auth.uid()),
    'paid', public.has_paid(gid), 'staff', public.teaches(gid))
  where public.member_of(gid)
$$;
grant execute on function public.group_access(uuid) to authenticated;
