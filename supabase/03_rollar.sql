-- Rollar: ota-ona (parent), ro'yxatdan o'tishda rol tanlash, ustozni baholash
-- Supabase SQL Editor'da bir marta ishga tushiriladi (01_schema.sql va 02_tolov.sql'dan keyin).
-- Eslatma: yangi enum qiymati ('parent') shu skriptning o'zida enum sifatida ishlatilmaydi:
-- hamma joyda role::text bilan solishtiriladi, shuning uchun skript bitta bo'lib ishlaydi.

alter type user_role add value if not exists 'parent';

-- ===== Profil: ota-ona so'ragan farzand logini =====
alter table profiles add column if not exists child_login text;

-- ===== Ro'yxatdan o'tish: so'ralgan rol (admin tanlab bo'lmaydi) =====
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := lower(coalesce(new.raw_user_meta_data->>'requested_role', 'student'));
  if r not in ('student', 'teacher', 'parent') then r := 'student'; end if;
  insert into profiles (id, full_name, phone, login, role, child_login)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    lower(coalesce(new.raw_user_meta_data->>'login', split_part(new.email, '@', 1))),
    r::user_role,
    case when r = 'parent' then nullif(lower(trim(coalesce(new.raw_user_meta_data->>'child_login', ''))), '') else null end
  );
  return new;
end $$;

-- ===== Ota-ona <-> farzand bog'lanishi =====
create table if not exists parent_links (
  parent_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create or replace function public.is_parent_of(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role()::text = 'parent', false) and exists (
    select 1 from parent_links l where l.parent_id = auth.uid() and l.student_id = sid)
$$;

-- Ota-onaning farzandlaridan biri shu o'qituvchida o'qiydimi
create or replace function public.parent_of_teacher(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role()::text = 'parent', false) and exists (
    select 1 from parent_links l
      join enrollments e on e.student_id = l.student_id
      join groups g on g.id = e.group_id
    where l.parent_id = auth.uid() and g.teacher_id = tid)
$$;

-- O'qituvchi (yoki admin) shu o'quvchining guruhlaridan birida dars beradimi
create or replace function public.teaches_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from enrollments e join groups g on g.id = e.group_id join profiles p on p.id = g.teacher_id
    where e.student_id = sid and g.teacher_id = auth.uid() and p.status = 'active')
$$;

create or replace function public.lesson_teacher(lid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select g.teacher_id from lessons l join groups g on g.id = l.group_id where l.id = lid
$$;

-- Dars tugagan va o'quvchi qatnashganmi (baholash mumkinmi)
create or replace function public.lesson_rateable(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role()::text = 'student', false) and exists (
    select 1 from lessons l join attendance a on a.lesson_id = l.id and a.student_id = auth.uid()
    where l.id = lid and l.ended_at is not null and a.status in ('present', 'late'))
$$;

grant execute on function public.is_parent_of(uuid), public.parent_of_teacher(uuid), public.teaches_student(uuid),
  public.lesson_teacher(uuid), public.lesson_rateable(uuid) to authenticated;

-- ===== Ota-ona fikrlari =====
create table if not exists parent_comments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists parent_comments_student_idx on parent_comments(student_id, created_at);

-- ===== Ota-onaning o'qituvchiga bahosi =====
create table if not exists teacher_ratings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  rater_id uuid not null references profiles(id) on delete cascade,
  rater_role text not null default 'parent' check (rater_role in ('parent', 'student')),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (teacher_id, rater_id)
);

-- ===== Har bir darsdan keyin o'quvchining bahosi =====
create table if not exists lesson_ratings (
  lesson_id uuid not null references lessons(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);
create index if not exists lesson_ratings_teacher_idx on lesson_ratings(teacher_id);

-- Majburiy baholash shu vaqtdan keyin tugagan darslar uchun (eski darslar o'quvchini to'smasin)
create table if not exists rating_config (
  id int primary key default 1 check (id = 1),
  starts_at timestamptz not null default now()
);
insert into rating_config (id) values (1) on conflict (id) do nothing;
alter table rating_config enable row level security;

-- ===== RLS =====
alter table parent_links enable row level security;
alter table parent_comments enable row level security;
alter table teacher_ratings enable row level security;
alter table lesson_ratings enable row level security;

grant select, insert, update, delete on parent_links, parent_comments, teacher_ratings to authenticated;
grant select, insert on lesson_ratings to authenticated;

drop policy if exists p_plinks_read on parent_links;
create policy p_plinks_read on parent_links for select using (parent_id = auth.uid() or public.is_admin());
drop policy if exists p_plinks_admin on parent_links;
create policy p_plinks_admin on parent_links for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists p_pcom_read on parent_comments;
create policy p_pcom_read on parent_comments for select using (
  parent_id = auth.uid() or public.is_admin() or public.teaches_student(student_id));
drop policy if exists p_pcom_insert on parent_comments;
create policy p_pcom_insert on parent_comments for insert with check (
  parent_id = auth.uid() and public.is_parent_of(student_id));
drop policy if exists p_pcom_delete on parent_comments;
create policy p_pcom_delete on parent_comments for delete using (parent_id = auth.uid() or public.is_admin());

drop policy if exists p_trate_read on teacher_ratings;
create policy p_trate_read on teacher_ratings for select using (rater_id = auth.uid() or public.is_admin());
drop policy if exists p_trate_insert on teacher_ratings;
create policy p_trate_insert on teacher_ratings for insert with check (
  rater_id = auth.uid() and rater_role = 'parent' and public.parent_of_teacher(teacher_id));
drop policy if exists p_trate_update on teacher_ratings;
create policy p_trate_update on teacher_ratings for update
  using (rater_id = auth.uid()) with check (
  rater_id = auth.uid() and rater_role = 'parent' and public.parent_of_teacher(teacher_id));

drop policy if exists p_lrate_read on lesson_ratings;
create policy p_lrate_read on lesson_ratings for select using (student_id = auth.uid() or public.is_admin());
drop policy if exists p_lrate_insert on lesson_ratings;
create policy p_lrate_insert on lesson_ratings for insert with check (
  student_id = auth.uid() and public.lesson_rateable(lesson_id)
  and teacher_id = public.lesson_teacher(lesson_id));

-- ===== RPC: majburiy baholash kutayotgan eng eski dars =====
create or replace function public.pending_rating()
returns table (lesson_id uuid, lesson_title text, teacher_id uuid, teacher_name text, ended_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, g.teacher_id, t.full_name, l.ended_at
  from lessons l
    join groups g on g.id = l.group_id
    join profiles t on t.id = g.teacher_id
    join attendance a on a.lesson_id = l.id and a.student_id = auth.uid()
  where public.my_role()::text = 'student'
    and l.ended_at is not null
    and l.ended_at >= (select starts_at from rating_config where id = 1)
    and a.status in ('present', 'late')
    and not exists (select 1 from lesson_ratings r where r.lesson_id = l.id and r.student_id = auth.uid())
  order by l.ended_at
  limit 1
$$;
grant execute on function public.pending_rating() to authenticated;

-- ===== RPC: o'qituvchi reytingi (o'zi yoki admin) =====
create or replace function public.teacher_rating_summary(p_teacher uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tid uuid := coalesce(p_teacher, auth.uid());
begin
  if not public.is_active() or (tid is distinct from auth.uid() and not public.is_admin()) then
    raise exception 'Ruxsat yo''q';
  end if;
  return jsonb_build_object(
    'lesson_avg', (select round(avg(r.stars)::numeric, 2) from lesson_ratings r where r.teacher_id = tid),
    'lesson_count', (select count(*) from lesson_ratings r where r.teacher_id = tid),
    'parent_avg', (select round(avg(r.stars)::numeric, 2) from teacher_ratings r where r.teacher_id = tid),
    'parent_count', (select count(*) from teacher_ratings r where r.teacher_id = tid),
    'comments', (
      select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at desc), '[]'::jsonb) from (
        select * from (
          select r.stars, r.comment, r.created_at, 'student'::text as source from lesson_ratings r
            where r.teacher_id = tid and coalesce(r.comment, '') <> ''
          union all
          select r.stars, r.comment, r.created_at, 'parent'::text as source from teacher_ratings r
            where r.teacher_id = tid and coalesce(r.comment, '') <> ''
        ) x order by x.created_at desc limit 20
      ) u)
  );
end $$;
grant execute on function public.teacher_rating_summary(uuid) to authenticated;

-- ===== RPC: admin uchun hamma o'qituvchilar reytingi =====
create or replace function public.teacher_ratings_overview()
returns table (teacher_id uuid, full_name text, lesson_avg numeric, lesson_count bigint, parent_avg numeric, parent_count bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name,
    (select round(avg(r.stars)::numeric, 2) from lesson_ratings r where r.teacher_id = p.id),
    (select count(*) from lesson_ratings r where r.teacher_id = p.id),
    (select round(avg(r.stars)::numeric, 2) from teacher_ratings r where r.teacher_id = p.id),
    (select count(*) from teacher_ratings r where r.teacher_id = p.id)
  from profiles p
  where p.role::text = 'teacher' and public.is_admin()
  order by p.full_name
$$;
grant execute on function public.teacher_ratings_overview() to authenticated;

-- ===== RPC: ota-ona paneli (faqat kuzatuv: dars/vazifa mazmuni berilmaydi) =====
create or replace function public.my_children()
returns table (id uuid, full_name text, login text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.login
  from parent_links l join profiles p on p.id = l.student_id
  where l.parent_id = auth.uid() and public.my_role()::text = 'parent'
  order by p.full_name
$$;
grant execute on function public.my_children() to authenticated;

create or replace function public.child_report(p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_parent_of(p_student) or public.is_admin()) then raise exception 'Ruxsat yo''q'; end if;
  return jsonb_build_object(
    'student', (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'login', p.login)
                from profiles p where p.id = p_student),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', g.id, 'name', g.name, 'subject', s.name,
                  'teacher_id', g.teacher_id, 'teacher_name', t.full_name, 'paid_until', e.paid_until)
                  order by s.name, g.name), '[]'::jsonb)
               from enrollments e
                 join groups g on g.id = e.group_id
                 join subjects s on s.id = g.subject_id
                 left join profiles t on t.id = g.teacher_id
               where e.student_id = p_student),
    'lessons', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', l.id, 'group_id', l.group_id, 'title', l.title, 'starts_at', l.starts_at,
                  'ended_at', l.ended_at, 'status', a.status) order by l.starts_at desc), '[]'::jsonb)
                from lessons l
                  join enrollments e on e.group_id = l.group_id and e.student_id = p_student
                  left join attendance a on a.lesson_id = l.id and a.student_id = p_student
                where l.ended_at is not null or l.starts_at < now()),
    'tasks', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', x.id, 'group_id', x.group_id, 'title', x.title, 'kind', x.kind, 'max_score', x.max_score,
                  'due_at', x.due_at, 'submitted_at', sb.submitted_at, 'score', sb.score,
                  'feedback', sb.feedback, 'graded_at', sb.graded_at) order by x.created_at desc), '[]'::jsonb)
              from assignments x
                join enrollments e on e.group_id = x.group_id and e.student_id = p_student
                left join submissions sb on sb.assignment_id = x.id and sb.student_id = p_student),
    'grades', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', gr.id, 'group_id', gr.group_id, 'value', gr.value, 'note', gr.note,
                  'created_at', gr.created_at) order by gr.created_at desc), '[]'::jsonb)
               from grades gr where gr.student_id = p_student)
  );
end $$;
grant execute on function public.child_report(uuid) to authenticated;
