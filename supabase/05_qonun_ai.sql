-- 05: Qonunchilik AI yordamchisi (lex.uz matnlari bo'yicha savol-javob)
-- Supabase SQL Editor'da bir marta ishga tushiriladi. Qayta ishga tushirish xavfsiz.

-- Matnni qidiruv uchun normallashtirish: kichik harf, tutuq belgilari olib tashlanadi
create or replace function public.law_norm(t text) returns text
language sql immutable parallel safe as $$
  select translate(lower(coalesce(t, '')), 'ʻʼ''‘’`´', '')
$$;

create table if not exists law_docs (
  key text primary key,
  name text not null,
  url text not null
);

create table if not exists law_articles (
  id bigserial primary key,
  law_key text not null references law_docs(key) on delete cascade,
  art text not null,
  title text not null default '',
  chapter text not null default '',
  body text not null,
  tsv tsvector generated always as (
    setweight(to_tsvector('simple', public.law_norm(title)), 'A') ||
    setweight(to_tsvector('simple', public.law_norm(body)), 'B')
  ) stored
);
create index if not exists law_articles_tsv on law_articles using gin (tsv);
create index if not exists law_articles_art on law_articles (law_key, art);

alter table law_docs enable row level security;
alter table law_articles enable row level security;
drop policy if exists p_law_docs_read on law_docs;
create policy p_law_docs_read on law_docs for select using (public.is_active());
drop policy if exists p_law_docs_admin on law_docs;
create policy p_law_docs_admin on law_docs for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists p_law_art_read on law_articles;
create policy p_law_art_read on law_articles for select using (public.is_active());
drop policy if exists p_law_art_admin on law_articles;
create policy p_law_art_admin on law_articles for all using (public.is_admin()) with check (public.is_admin());

-- So'z o'zagi: o'zbekcha qo'shimchalarni qirqish (oddiy, mukammal emas)
create or replace function public.law_stem(w text) returns text
language plpgsql immutable parallel safe as $$
declare i int;
begin
  for i in 1..3 loop
    exit when length(w) <= 4;
    w := regexp_replace(w, '(larining|larning|laridan|larida|lariga|larini|lardan|larda|larga|larni|lari|lar|ining|idagi|dagi|ning|imiz|ingiz|ini|iga|ida|idan|dan|da|ga|ni|si|ilgan|lgan|gan|iladi|ladi|adi|ish|moq|mi|i)$', '');
  end loop;
  if length(w) > 5 and right(w, 1) in ('k', 'g', 'q') then w := left(w, length(w) - 1); end if;
  return w;
end $$;

-- Qidiruv: so'z o'zaklari bo'yicha. Avval eng ko'p so'z mos kelgan moddalar.
-- p_laws: AI taxmin qilgan qonunlar (key), p_art: modda raqami - ular oldinga chiqadi.
drop function if exists public.law_search(text, int);
create or replace function public.law_search(q text, p_laws text[] default null, p_art text default null, n int default 8)
returns table (law_key text, law_name text, url text, art text, title text, body text, rank real)
language plpgsql stable security definer set search_path = public as $$
declare
  stems text[];
  tq tsquery;
  art_no text;
  qn text := public.law_norm(q);
begin
  if not public.is_active() then raise exception 'ruxsat yoʻq'; end if;
  art_no := coalesce(nullif(p_art, ''), substring(qn from '(\d+)\s*-?\s*modda'));
  select array_agg(distinct s) into stems from (
    select public.law_stem(w) s
    from regexp_split_to_table(qn, '[^a-z0-9]+') w
    where length(w) >= 3 and w !~ '^\d+$' and w not in (
      'va','bilan','uchun','qanday','qanaqa','nima','nimaga','nimani','nechta','qachon','qaysi','kim','kimlar','necha','haqida','boyicha','buyicha',
      'modda','moddasi','moddada','moddasida','moddaga','bormi','mumkin','mumkinmi','kerak','kerakmi','emas','yoki','agar','shu','ham','bor','yoq',
      'nimalar','qilinadi','etiladi','boladi','bolsa','bolad','ayting','aytib','bering','tushuntiring','iltimos','savol','javob','deydi','degan','nimalarni',
      'respublikasi','ozbekiston','ozbekistonda','respublikasining','ozbekistonning'
    )) x where length(s) >= 3;
  if stems is null then
    if art_no is null then return; end if;
    stems := array[]::text[];
  end if;
  if array_length(stems, 1) > 0 then
    tq := to_tsquery('simple', array_to_string(array(select quote_literal(x) || ':*' from unnest(stems) x), ' | '));
  end if;
  return query
    with hit as (
      select d.key, coalesce(d.key = any(p_laws), false) as h from law_docs d
    ), c as (
      select a.*, hit.h as law_hit,
        (select count(*) from unnest(stems) s where a.tsv @@ to_tsquery('simple', quote_literal(s) || ':*')) as cov,
        (select count(*) from unnest(stems) s where a.tsv @@ to_tsquery('simple', quote_literal(s) || ':*A')) as tcov
      from law_articles a join hit on hit.key = a.law_key
      where (tq is not null and a.tsv @@ tq) or (art_no is not null and a.art = art_no)
    )
    select c.law_key, d.name, d.url, c.art, c.title, c.body,
      (c.cov + 1.5 * c.tcov + case when c.law_hit then 2 else 0 end
        + case when art_no is not null and c.art = art_no then (case when c.law_hit then 6 else 0.3 end) else 0 end
        + coalesce(ts_rank_cd(c.tsv, tq, 32), 0))::real as r
    from c join law_docs d on d.key = c.law_key
    order by r desc
    limit greatest(1, least(n, 15));
end $$;

-- Kunlik limit: har bir foydalanuvchiga kuniga 20 ta savol (admin'ga 200)
create table if not exists ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);
alter table ai_usage enable row level security;
drop policy if exists p_ai_usage_self on ai_usage;
create policy p_ai_usage_self on ai_usage for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.ai_take_quota() returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  lim int := case when public.is_admin() then 200 else 20 end;
  today date := (now() at time zone 'Asia/Tashkent')::date;
  used int;
begin
  if not public.is_active() then raise exception 'ruxsat yoʻq'; end if;
  insert into ai_usage (user_id, day, n) values (auth.uid(), today, 1)
  on conflict (user_id, day) do update set n = ai_usage.n + 1 where ai_usage.n < lim
  returning n into used;
  if used is null then return -1; end if;
  return lim - used;  -- qolgan savollar soni
end $$;

create or replace function public.ai_quota_left() returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 200 else 20 end
    - coalesce((select n from ai_usage where user_id = auth.uid() and day = (now() at time zone 'Asia/Tashkent')::date), 0)
$$;

grant execute on function public.law_search(text, text[], text, int) to authenticated;
grant execute on function public.ai_take_quota() to authenticated;
grant execute on function public.ai_quota_left() to authenticated;
