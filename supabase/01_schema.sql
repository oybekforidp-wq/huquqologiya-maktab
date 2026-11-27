-- Huquqologiya onlayn maktab: asosiy sxema
-- Supabase SQL Editor'da bir marta ishga tushiriladi.

create extension if not exists pgcrypto;

-- ===== Turlar =====
do $$ begin
  create type user_role as enum ('student', 'teacher', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type user_status as enum ('pending', 'active', 'rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type attendance_status as enum ('present', 'late', 'absent');
exception when duplicate_object then null; end $$;
do $$ begin
  create type assignment_kind as enum ('test', 'written', 'file', 'kazus');
exception when duplicate_object then null; end $$;

-- ===== Jadvallar =====
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  login text not null unique,
  role user_role not null default 'student',
  status user_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  teacher_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

create table if not exists enrollments (
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  meeting_url text,
  recording_url text,
  is_live boolean not null default false,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lessons_group_idx on lessons(group_id, starts_at);

-- Doska sahifalari: bo'sh doska, PDF sahifasi yoki rasm + ustidagi chizmalar
create table if not exists board_pages (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  position int not null default 0,
  kind text not null default 'blank' check (kind in ('blank', 'image')),
  title text,
  background_path text,          -- storage: board/<lesson>/<file>
  scene jsonb not null default '{}'::jsonb,  -- chizmalar
  updated_at timestamptz not null default now()
);
create index if not exists board_pages_lesson_idx on board_pages(lesson_id, position);

create table if not exists lesson_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  name text not null,
  path text not null,            -- storage: files/<lesson>/<file>
  created_at timestamptz not null default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  title text not null,
  kind assignment_kind not null,
  instructions text,
  questions jsonb not null default '[]'::jsonb, -- test: [{q, o:[..], c, a}]
  due_at timestamptz,
  max_score int not null default 5,
  created_at timestamptz not null default now()
);
create index if not exists assignments_group_idx on assignments(group_id, due_at);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  text_answer text,
  file_paths text[] not null default '{}',
  auto_score numeric,
  score numeric,
  feedback text,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

create table if not exists attendance (
  lesson_id uuid not null references lessons(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  status attendance_status not null,
  marked_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);

-- Jurnaldagi qo'lda qo'yiladigan baholar (darsdagi javob, og'zaki va h.k.)
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  value int not null check (value between 1 and 5),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Test bazasi (botdagi 8–11-sinf testlari shu yerga ko'chiriladi)
create table if not exists question_bank (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  grade text,                    -- '8-sinf' ...
  topic text,                    -- mavzu nomi
  level int,
  q text not null,
  options text[] not null,
  correct int not null,
  explanation text
);
create index if not exists question_bank_topic_idx on question_bank(subject_id, grade, topic);

-- ===== Yordamchi funksiyalar =====
create or replace function public.my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid() and status = 'active'), false)
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from profiles where id = auth.uid()), false)
$$;

create or replace function public.teaches(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from groups g join profiles p on p.id = g.teacher_id
    where g.id = gid and g.teacher_id = auth.uid() and p.status = 'active')
$$;

create or replace function public.member_of(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.teaches(gid) or (public.is_active() and exists (
    select 1 from enrollments e where e.group_id = gid and e.student_id = auth.uid()))
$$;

create or replace function public.lesson_group(lid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from lessons where id = lid
$$;

create or replace function public.assignment_group(aid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from assignments where id = aid
$$;

-- Ro'yxatdan o'tganda profil avtomatik yaratiladi (holati: pending)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone, login)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    lower(coalesce(new.raw_user_meta_data->>'login', split_part(new.email, '@', 1)))
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Login band emasligini ro'yxatdan o'tishdan oldin tekshirish
create or replace function public.login_available(p_login text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where login = lower(p_login))
$$;
grant execute on function public.login_available(text) to anon, authenticated;

-- Test topshirish: ball serverda hisoblanadi, to'g'ri javoblar o'quvchiga oldindan ko'rinmaydi
create or replace function public.submit_test(p_assignment uuid, p_answers jsonb) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  a assignments;
  total int; right_count int := 0; i int; s numeric;
begin
  select * into a from assignments where id = p_assignment;
  if a.id is null or a.kind <> 'test' then raise exception 'Vazifa topilmadi'; end if;
  if not public.member_of(a.group_id) then raise exception 'Ruxsat yo''q'; end if;
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
grant execute on function public.submit_test(uuid, jsonb) to authenticated;

-- O'quvchiga test savollari to'g'ri javobsiz beriladi (topshirgandan keyin to'liq)
create or replace function public.assignment_for_student(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a assignments; done boolean;
begin
  select * into a from assignments where id = p_assignment;
  if a.id is null or not public.member_of(a.group_id) then return null; end if;
  done := exists (select 1 from submissions where assignment_id = a.id and student_id = auth.uid());
  return jsonb_build_object(
    'id', a.id, 'title', a.title, 'kind', a.kind, 'instructions', a.instructions,
    'due_at', a.due_at, 'max_score', a.max_score, 'group_id', a.group_id,
    'questions', case when done or public.teaches(a.group_id) then a.questions
      else (select coalesce(jsonb_agg(q - 'c' - 'a'), '[]'::jsonb) from jsonb_array_elements(a.questions) q) end
  );
end $$;
grant execute on function public.assignment_for_student(uuid) to authenticated;

-- Darsga kirganda yo'qlama avtomatik "keldi" (dars boshlanganidan 10 daqiqa o'tsa "kech qoldi")
create or replace function public.join_lesson(p_lesson uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l lessons;
begin
  select * into l from lessons where id = p_lesson;
  if l.id is null or not public.member_of(l.group_id) then raise exception 'Ruxsat yo''q'; end if;
  if public.teaches(l.group_id) then return; end if;
  insert into attendance (lesson_id, student_id, status)
  values (l.id, auth.uid(), case when now() > l.starts_at + interval '10 minutes' then 'late'::attendance_status else 'present'::attendance_status end)
  on conflict (lesson_id, student_id) do nothing;
end $$;
grant execute on function public.join_lesson(uuid) to authenticated;

-- ===== RLS =====
alter table profiles enable row level security;
alter table subjects enable row level security;
alter table groups enable row level security;
alter table enrollments enable row level security;
alter table lessons enable row level security;
alter table board_pages enable row level security;
alter table lesson_files enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table attendance enable row level security;
alter table grades enable row level security;
alter table question_bank enable row level security;

-- profiles
drop policy if exists p_profiles_self on profiles;
create policy p_profiles_self on profiles for select using (id = auth.uid() or public.my_role() in ('admin', 'teacher'));
drop policy if exists p_profiles_admin on profiles;
create policy p_profiles_admin on profiles for update using (public.is_admin()) with check (public.is_admin());

-- subjects: hamma faol foydalanuvchi o'qiydi, admin o'zgartiradi
drop policy if exists p_subjects_read on subjects;
create policy p_subjects_read on subjects for select using (public.is_active());
drop policy if exists p_subjects_admin on subjects;
create policy p_subjects_admin on subjects for all using (public.is_admin()) with check (public.is_admin());

-- groups
drop policy if exists p_groups_read on groups;
create policy p_groups_read on groups for select using (public.member_of(id));
drop policy if exists p_groups_admin on groups;
create policy p_groups_admin on groups for all using (public.is_admin()) with check (public.is_admin());

-- enrollments
drop policy if exists p_enr_read on enrollments;
create policy p_enr_read on enrollments for select using (student_id = auth.uid() or public.teaches(group_id));
drop policy if exists p_enr_admin on enrollments;
create policy p_enr_admin on enrollments for all using (public.is_admin()) with check (public.is_admin());

-- lessons
drop policy if exists p_lessons_read on lessons;
create policy p_lessons_read on lessons for select using (public.member_of(group_id));
drop policy if exists p_lessons_write on lessons;
create policy p_lessons_write on lessons for all using (public.teaches(group_id)) with check (public.teaches(group_id));

-- board_pages
drop policy if exists p_board_read on board_pages;
create policy p_board_read on board_pages for select using (public.member_of(public.lesson_group(lesson_id)));
drop policy if exists p_board_write on board_pages;
create policy p_board_write on board_pages for all using (public.teaches(public.lesson_group(lesson_id))) with check (public.teaches(public.lesson_group(lesson_id)));

-- lesson_files
drop policy if exists p_files_read on lesson_files;
create policy p_files_read on lesson_files for select using (public.member_of(public.lesson_group(lesson_id)));
drop policy if exists p_files_write on lesson_files;
create policy p_files_write on lesson_files for all using (public.teaches(public.lesson_group(lesson_id))) with check (public.teaches(public.lesson_group(lesson_id)));

-- assignments: o'qituvchi to'liq; o'quvchi savollarni faqat assignment_for_student orqali oladi
drop policy if exists p_asg_teacher on assignments;
create policy p_asg_teacher on assignments for all using (public.teaches(group_id)) with check (public.teaches(group_id));
drop policy if exists p_asg_student on assignments;
create policy p_asg_student on assignments for select using (public.member_of(group_id));
-- o'quvchiga questions ustuni berilmaydi
revoke select on assignments from authenticated;
grant select (id, group_id, lesson_id, title, kind, instructions, due_at, max_score, created_at) on assignments to authenticated;
grant insert, update, delete on assignments to authenticated;

-- submissions
drop policy if exists p_sub_read on submissions;
create policy p_sub_read on submissions for select using (student_id = auth.uid() or public.teaches(public.assignment_group(assignment_id)));
drop policy if exists p_sub_insert on submissions;
create policy p_sub_insert on submissions for insert with check (
  student_id = auth.uid() and public.member_of(public.assignment_group(assignment_id))
  and (select kind from assignments where id = assignment_id) <> 'test');
drop policy if exists p_sub_student_update on submissions;
create policy p_sub_student_update on submissions for update using (student_id = auth.uid() and graded_at is null) with check (student_id = auth.uid() and score is null);
drop policy if exists p_sub_teacher on submissions;
create policy p_sub_teacher on submissions for update using (public.teaches(public.assignment_group(assignment_id)));

-- attendance
drop policy if exists p_att_read on attendance;
create policy p_att_read on attendance for select using (student_id = auth.uid() or public.teaches(public.lesson_group(lesson_id)));
drop policy if exists p_att_write on attendance;
create policy p_att_write on attendance for all using (public.teaches(public.lesson_group(lesson_id))) with check (public.teaches(public.lesson_group(lesson_id)));

-- grades
drop policy if exists p_grades_read on grades;
create policy p_grades_read on grades for select using (student_id = auth.uid() or public.teaches(group_id));
drop policy if exists p_grades_write on grades;
create policy p_grades_write on grades for all using (public.teaches(group_id)) with check (public.teaches(group_id));

-- question_bank: faqat o'qituvchi/admin (vazifa tuzishda)
drop policy if exists p_qb_read on question_bank;
create policy p_qb_read on question_bank for select using (public.my_role() in ('admin', 'teacher'));
drop policy if exists p_qb_admin on question_bank;
create policy p_qb_admin on question_bank for all using (public.is_admin()) with check (public.is_admin());

-- ===== Fayl saqlash (Storage) =====
insert into storage.buckets (id, name, public) values ('maktab', 'maktab', false)
on conflict (id) do nothing;

-- Yo'l: <lesson_id>/... (doska fonlari, dars fayllari) yoki sub/<assignment_id>/<user_id>/... (o'quvchi javoblari)
drop policy if exists s_read on storage.objects;
create policy s_read on storage.objects for select using (
  bucket_id = 'maktab' and (
    (split_part(name, '/', 1) <> 'sub' and public.member_of(public.lesson_group(split_part(name, '/', 1)::uuid)))
    or (split_part(name, '/', 1) = 'sub' and (split_part(name, '/', 3) = auth.uid()::text
        or public.teaches(public.assignment_group(split_part(name, '/', 2)::uuid))))
  ));
drop policy if exists s_write on storage.objects;
create policy s_write on storage.objects for insert with check (
  bucket_id = 'maktab' and (
    (split_part(name, '/', 1) <> 'sub' and public.teaches(public.lesson_group(split_part(name, '/', 1)::uuid)))
    or (split_part(name, '/', 1) = 'sub' and split_part(name, '/', 3) = auth.uid()::text
        and public.member_of(public.assignment_group(split_part(name, '/', 2)::uuid)))
  ));
drop policy if exists s_delete on storage.objects;
create policy s_delete on storage.objects for delete using (
  bucket_id = 'maktab' and split_part(name, '/', 1) <> 'sub'
  and public.teaches(public.lesson_group(split_part(name, '/', 1)::uuid)));

-- ===== Jonli doska uchun realtime =====
alter publication supabase_realtime add table board_pages;
alter publication supabase_realtime add table lessons;

-- ===== Boshlang'ich ma'lumot =====
insert into subjects (name, description) values ('Huquqshunoslik', 'Milliy sertifikat va OTMga tayyorgarlik')
on conflict (name) do nothing;
