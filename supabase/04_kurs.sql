-- Kurs shabloni: sanasiz darslar (Dars 1..N) — o'quvchi PDF, kalit PDF, testlar.
-- Mazmun bu repoga yozilmaydi: fayllar yopiq 'kurs' bucket'ida, testlar course_lessons jadvalida.
-- Kalitlar va javoblar faqat ustoz/admin'ga ko'rinadi.

create table if not exists course_lessons (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  num int not null,
  title text not null,
  module text,
  type text,                      -- yangi | amaliy | nazorat | takror | sinov
  pdf_path text,                  -- 'kurs' bucket ichidagi yo'l (o'quvchi nusxasi)
  key_path text,                  -- 'kurs' bucket ichidagi yo'l (kalit, faqat ustoz)
  content jsonb not null default '{}'::jsonb,  -- {sinf, uy, ochiq, kazus, yozma, case}
  updated_at timestamptz not null default now(),
  unique (subject_id, num)
);

alter table lessons add column if not exists course_lesson_id uuid references course_lessons(id) on delete set null;
alter table assignments add column if not exists course_lesson_id uuid references course_lessons(id) on delete set null;

alter table course_lessons enable row level security;
grant select, insert, update, delete on course_lessons to authenticated;
drop policy if exists p_cl_staff on course_lessons;
create policy p_cl_staff on course_lessons for select using (public.my_role() in ('admin', 'teacher'));
drop policy if exists p_cl_admin on course_lessons;
create policy p_cl_admin on course_lessons for all using (public.is_admin()) with check (public.is_admin());

-- ===== Yopiq 'kurs' bucket =====
insert into storage.buckets (id, name, public) values ('kurs', 'kurs', false)
on conflict (id) do nothing;

-- O'quvchi kurs faylini faqat u biriktirilgan va ochiq (to'langan/tekin) dars orqali ko'radi
create or replace function public.kurs_file_open(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'teacher')
    or exists (select 1 from lesson_files lf where lf.path = 'kurs/' || p_name and public.lesson_open(lf.lesson_id))
$$;
grant execute on function public.kurs_file_open(text) to authenticated;

-- 'maktab' siyosatlari boshqa bucket'larda uuid'ga o'girishda xato bermasligi uchun CASE bilan qayta yoziladi
drop policy if exists s_read on storage.objects;
create policy s_read on storage.objects for select using (
  case when bucket_id = 'maktab' then
    case when split_part(name, '/', 1) = 'sub' then
      split_part(name, '/', 3) = auth.uid()::text
      or public.teaches(public.assignment_group(split_part(name, '/', 2)::uuid))
    else public.lesson_open(split_part(name, '/', 1)::uuid) end
  else false end);
drop policy if exists s_write on storage.objects;
create policy s_write on storage.objects for insert with check (
  case when bucket_id = 'maktab' then
    case when split_part(name, '/', 1) = 'sub' then
      split_part(name, '/', 3) = auth.uid()::text
      and public.assignment_open(split_part(name, '/', 2)::uuid)
    else public.teaches(public.lesson_group(split_part(name, '/', 1)::uuid)) end
  else false end);
drop policy if exists s_delete on storage.objects;
create policy s_delete on storage.objects for delete using (
  case when bucket_id = 'maktab' and split_part(name, '/', 1) <> 'sub'
    then public.teaches(public.lesson_group(split_part(name, '/', 1)::uuid))
  else false end);

drop policy if exists s_kurs_read on storage.objects;
create policy s_kurs_read on storage.objects for select using (
  bucket_id = 'kurs' and public.kurs_file_open(name));
drop policy if exists s_kurs_insert on storage.objects;
create policy s_kurs_insert on storage.objects for insert with check (bucket_id = 'kurs' and public.is_admin());
drop policy if exists s_kurs_update on storage.objects;
create policy s_kurs_update on storage.objects for update using (bucket_id = 'kurs' and public.is_admin());
drop policy if exists s_kurs_delete on storage.objects;
create policy s_kurs_delete on storage.objects for delete using (bucket_id = 'kurs' and public.is_admin());

-- ===== Guruh darsiga "Dars N" biriktirish =====
-- Dars fayli (o'quvchi PDF) + sinf testi + uy testi + yozma topshiriq + kazus yaratiladi.
-- Qayta bosilsa, avval yaratilgan (hali javob berilmagan) nusxalar yangilanadi.
create or replace function public.attach_course_lesson(p_lesson uuid, p_num int, p_set_title boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l lessons; cl course_lessons; gid uuid; sid uuid;
  c jsonb; txt text; k jsonb; i int; made int := 0;
begin
  select * into l from lessons where id = p_lesson;
  if l.id is null then raise exception 'Dars topilmadi'; end if;
  gid := l.group_id;
  if not public.teaches(gid) then raise exception 'Faqat guruh ustozi biriktira oladi'; end if;
  select subject_id into sid from groups where id = gid;
  select * into cl from course_lessons where subject_id = sid and num = p_num;
  if cl.id is null then raise exception 'Bu fan uchun % -dars shablonda yo''q', p_num; end if;
  c := cl.content;

  -- eski biriktirishni tozalash (javob topshirilgan vazifalar saqlanadi)
  delete from lesson_files where lesson_id = l.id and path like 'kurs/%';
  delete from assignments a where a.lesson_id = l.id and a.course_lesson_id is not null
    and not exists (select 1 from submissions s where s.assignment_id = a.id);

  update lessons set course_lesson_id = cl.id,
    title = case when p_set_title then cl.num || '-dars. ' || cl.title else title end
  where id = l.id;

  if cl.pdf_path is not null then
    insert into lesson_files (lesson_id, name, path)
    values (l.id, cl.num || '-dars. ' || left(cl.title, 80) || '.pdf', 'kurs/' || cl.pdf_path);
  end if;

  if jsonb_array_length(coalesce(c->'sinf', '[]')) > 0
     and not exists (select 1 from assignments where lesson_id = l.id and course_lesson_id = cl.id and title like '%sinf testi') then
    insert into assignments (group_id, lesson_id, course_lesson_id, title, kind, instructions, questions, max_score)
    values (gid, l.id, cl.id, cl.num || '-dars: sinf testi', 'test', 'Darsda bajariladi.', c->'sinf', 5);
    made := made + 1;
  end if;

  if jsonb_array_length(coalesce(c->'uy', '[]')) > 0
     and not exists (select 1 from assignments where lesson_id = l.id and course_lesson_id = cl.id and title like '%uy testi') then
    insert into assignments (group_id, lesson_id, course_lesson_id, title, kind, instructions, questions, due_at, max_score)
    values (gid, l.id, cl.id,
      case when cl.type = 'nazorat' then cl.num || '-dars: nazorat testi'
           when cl.type = 'sinov' then cl.num || '-dars: sinov imtihoni testi' else cl.num || '-dars: uy testi' end,
      'test', case when cl.type = 'nazorat' then 'Nazorat ishi.' when cl.type = 'sinov' then 'Sinov imtihoni.' else 'Uy vazifasi.' end,
      c->'uy', l.starts_at + interval '2 days', 5);
    made := made + 1;
  end if;

  -- Yozma: ochiq savollar + yozma topshiriq (javobsiz)
  txt := '';
  if jsonb_array_length(coalesce(c->'ochiq', '[]')) > 0 then
    select string_agg(n || '. ' || (q->>'q'), E'\n' order by n) into txt
    from jsonb_array_elements(c->'ochiq') with ordinality as t(q, n);
    txt := 'Qisqa javob yozing:' || E'\n' || txt;
  end if;
  if coalesce(c->>'yozma', '') <> '' then
    txt := txt || case when txt = '' then '' else E'\n\n' end || 'Yozma topshiriq: ' || (c->>'yozma');
  end if;
  if txt <> '' and not exists (select 1 from assignments where lesson_id = l.id and course_lesson_id = cl.id and kind = 'written') then
    insert into assignments (group_id, lesson_id, course_lesson_id, title, kind, instructions, due_at, max_score)
    values (gid, l.id, cl.id, cl.num || '-dars: yozma topshiriq', 'written', txt, l.starts_at + interval '2 days', 5);
    made := made + 1;
  end if;

  -- Kazus(lar): matn + savollar (javobsiz)
  txt := '';
  i := 0;
  for k in select value from jsonb_array_elements(coalesce(c->'kazus', '[]')) loop
    i := i + 1;
    txt := txt || case when txt = '' then '' else E'\n\n' end
      || i || '-kazus. ' || coalesce(k->>'title', '') || E'\n'
      || coalesce((select string_agg(value, E'\n') from jsonb_array_elements_text(coalesce(k->'matn', '[]'))), '')
      || coalesce(E'\n' || (select string_agg('— ' || (qa->>0), E'\n') from jsonb_array_elements(coalesce(k->'qa', '[]')) qa), '');
  end loop;
  if coalesce(c->>'case', '') <> '' then
    txt := txt || case when txt = '' then '' else E'\n\n' end || 'Kazus. ' || (c->>'case');
  end if;
  if txt <> '' and not exists (select 1 from assignments where lesson_id = l.id and course_lesson_id = cl.id and kind = 'kazus') then
    insert into assignments (group_id, lesson_id, course_lesson_id, title, kind, instructions, due_at, max_score)
    values (gid, l.id, cl.id, cl.num || '-dars: kazus', 'kazus', txt, l.starts_at + interval '2 days', 5);
    made := made + 1;
  end if;

  return jsonb_build_object('num', cl.num, 'title', cl.title, 'assignments', made);
end $$;
grant execute on function public.attach_course_lesson(uuid, int, boolean) to authenticated;

-- Ustoz uchun: dars kalitining yo'li va javoblari (o'quvchiga hech qachon qaytmaydi)
create or replace function public.course_lesson_for_staff(p_lesson uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', cl.id, 'num', cl.num, 'title', cl.title, 'type', cl.type,
    'pdf_path', cl.pdf_path, 'key_path', cl.key_path)
  from lessons l join course_lessons cl on cl.id = l.course_lesson_id
  where l.id = p_lesson and public.teaches(l.group_id)
$$;
grant execute on function public.course_lesson_for_staff(uuid) to authenticated;
