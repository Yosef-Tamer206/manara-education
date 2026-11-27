-- Manara subscriptions: settings, subscriptions, the bot's decision function and access rules.
-- Seed values (price 150 / 50 EGP, number 01000000000) are placeholders: the teacher edits them in the admin.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- 1. Admin-editable settings (prices, payment number, unconfirmed window)
create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists ss_r on public.site_settings;
drop policy if exists ss_w on public.site_settings;
create policy ss_r on public.site_settings for select
  using (key in ('price_month', 'price_lesson') or public.is_approved() or public.is_teacher());
create policy ss_w on public.site_settings for all
  using (public.is_teacher()) with check (public.is_teacher());
insert into public.site_settings (key, value) values
  ('price_month', '150'), ('price_lesson', '50'), ('payment_number', '01000000000'),
  ('payment_methods', 'فودافون كاش / إنستاباي'), ('unconfirmed_hours', '48')
on conflict (key) do nothing;

-- 2. Subscriptions (one row per request the bot decided on)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('month', 'lesson')),
  lesson_id uuid references public.lessons(id) on delete set null,
  amount integer not null,
  reference text not null,
  receipt_path text,
  receipt_hash text,
  status text not null check (status in ('active', 'rejected', 'revoked')),
  reject_reason text,
  starts_at timestamptz,
  ends_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists subs_ref_uq on public.subscriptions (lower(reference)) where status <> 'rejected';
create unique index if not exists subs_hash_uq on public.subscriptions (receipt_hash) where status <> 'rejected' and receipt_hash is not null;
create index if not exists subs_student_idx on public.subscriptions (student_id, created_at desc);
alter table public.subscriptions enable row level security;
drop policy if exists sub_s on public.subscriptions;
drop policy if exists sub_t on public.subscriptions;
create policy sub_s on public.subscriptions for select using (student_id = auth.uid() or public.is_teacher());
create policy sub_t on public.subscriptions for update using (public.is_teacher()) with check (public.is_teacher());

-- 3. A subscription is live when active, not past its end, and either confirmed by the teacher
--    or still inside the unconfirmed window.
create or replace function public.unconfirmed_hours() returns int language sql stable security definer set search_path = public as $$
  select coalesce((select value::int from site_settings where key = 'unconfirmed_hours' and value ~ '^[0-9]+$'), 48)
$$;

create or replace function public.sub_end(s public.subscriptions) returns timestamptz language sql stable security definer set search_path = public as $$
  select case
    when s.status <> 'active' then null
    when s.confirmed_at is not null then coalesce(s.ends_at, 'infinity'::timestamptz)
    else least(coalesce(s.ends_at, 'infinity'::timestamptz), s.created_at + make_interval(hours => public.unconfirmed_hours()))
  end
$$;

create or replace function public.sub_live(s public.subscriptions) returns boolean language sql stable security definer set search_path = public as $$
  select s.status = 'active' and public.sub_end(s) > now()
$$;

create or replace function public.has_lesson_access(p_lesson uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_teacher() or (
    public.is_approved() and exists (
      select 1 from subscriptions s
      where s.student_id = auth.uid() and public.sub_live(s) and (s.plan = 'month' or s.lesson_id = p_lesson)
    )
  )
$$;

-- 4. The bot: accepts or rejects a request using fixed rules
create or replace function public.request_subscription(
  p_plan text, p_lesson uuid, p_amount int, p_reference text, p_receipt_path text, p_receipt_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof profiles;
  v_key text;
  v_txt text;
  v_price int;
  v_ref text := btrim(coalesce(p_reference, ''));
  v_hash text := nullif(btrim(coalesce(p_receipt_hash, '')), '');
  v_code text;
  v_msg text;
  v_end timestamptz;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not allowed'; end if;
  select * into v_prof from profiles where id = v_uid;
  if v_prof.id is null or v_prof.role <> 'student' then raise exception 'not allowed'; end if;
  if not v_prof.approved then
    return jsonb_build_object('ok', false, 'code', 'not_approved', 'message', 'حسابك لسه مستني موافقة المدرس. اشترك بعد ما يتفعّل.');
  end if;
  if p_plan not in ('month', 'lesson') then raise exception 'bad plan'; end if;

  v_key := case when p_plan = 'month' then 'price_month' else 'price_lesson' end;
  select value into v_txt from site_settings where key = v_key;
  if v_txt is null or btrim(v_txt) !~ '^[0-9]+$' then
    return jsonb_build_object('ok', false, 'code', 'not_configured', 'message', 'الاشتراك لسه مش متاح. جرّب بعد شوية.');
  end if;
  v_price := btrim(v_txt)::int;

  if (select count(*) from subscriptions where student_id = v_uid and created_at > now() - interval '24 hours') >= 6 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'حاولت كتير النهارده. جرّب تاني بكرة أو كلّم المدرس.');
  end if;

  if p_plan = 'lesson' and not exists (
    select 1 from lessons l join courses c on c.id = l.course_id where l.id = p_lesson and c.published
  ) then
    return jsonb_build_object('ok', false, 'code', 'bad_lesson', 'message', 'الدرس ده مش متاح.');
  end if;

  if exists (
    select 1 from subscriptions s
    where s.student_id = v_uid and public.sub_live(s)
      and (s.plan = 'month' or (p_plan = 'lesson' and s.lesson_id = p_lesson))
  ) then
    v_code := 'already_active';
    v_msg := case when p_plan = 'month' then 'عندك اشتراك شغال بالفعل.' else 'الدرس ده مفتوح عندك بالفعل.' end;
  elsif (select count(*) from subscriptions s where s.student_id = v_uid and s.status = 'active' and s.confirmed_at is null and public.sub_live(s)) >= 2 then
    v_code := 'pending_confirmation';
    v_msg := 'عندك طلبين لسه المدرس ما أكدش استلام فلوسهم. استنى التأكيد.';
  elsif p_amount is distinct from v_price then
    v_code := 'wrong_amount';
    v_msg := 'المبلغ مش مطابق للسعر (' || v_price || ' جنيه).';
  elsif length(v_ref) < 6 or length(v_ref) > 40 or v_ref ~ '^(.)\1*$' then
    v_code := 'bad_reference';
    v_msg := 'رقم العملية غير صحيح. اكتبه زي ما ظاهر في رسالة التحويل.';
  elsif exists (select 1 from subscriptions where lower(reference) = lower(v_ref) and status <> 'rejected') then
    v_code := 'duplicate_reference';
    v_msg := 'رقم العملية ده اتستخدم قبل كده.';
  elsif v_hash is null or p_receipt_path is null or split_part(p_receipt_path, '/', 1) <> v_uid::text then
    v_code := 'no_receipt';
    v_msg := 'لازم ترفع صورة إيصال التحويل.';
  elsif exists (select 1 from subscriptions where receipt_hash = v_hash and status <> 'rejected') then
    v_code := 'duplicate_receipt';
    v_msg := 'صورة الإيصال دي اتستخدمت قبل كده.';
  end if;

  if v_code is not null then
    insert into subscriptions (student_id, plan, lesson_id, amount, reference, receipt_path, status, reject_reason)
    values (v_uid, p_plan, case when p_plan = 'lesson' then p_lesson end, coalesce(p_amount, 0), left(v_ref, 40), p_receipt_path, 'rejected', v_code);
    return jsonb_build_object('ok', false, 'code', v_code, 'message', v_msg);
  end if;

  v_end := case when p_plan = 'month' then now() + interval '30 days' end;
  begin
    insert into subscriptions (student_id, plan, lesson_id, amount, reference, receipt_path, receipt_hash, status, starts_at, ends_at)
    values (v_uid, p_plan, case when p_plan = 'lesson' then p_lesson end, p_amount, v_ref, p_receipt_path, v_hash, 'active', now(), v_end)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate_reference', 'message', 'رقم العملية أو الإيصال اتستخدم قبل كده.');
  end;
  return jsonb_build_object('ok', true, 'id', v_id, 'plan', p_plan, 'ends_at', v_end, 'unconfirmed_hours', public.unconfirmed_hours());
end $$;

-- 5. Lists for the student (own rows) and the teacher (all rows)
create or replace function public.list_subscriptions() returns table (
  id uuid, student_id uuid, student_name text, plan text, lesson_id uuid, lesson_title text, amount int, reference text,
  receipt_path text, status text, reject_reason text, starts_at timestamptz, ends_at timestamptz, confirmed_at timestamptz,
  created_at timestamptz, live boolean, effective_end timestamptz
) language sql stable security definer set search_path = public as $$
  select s.id, s.student_id, p.full_name, s.plan, s.lesson_id, l.title, s.amount, s.reference,
         s.receipt_path, s.status, s.reject_reason, s.starts_at, s.ends_at, s.confirmed_at,
         s.created_at, public.sub_live(s), nullif(public.sub_end(s), 'infinity'::timestamptz)
  from subscriptions s
  join profiles p on p.id = s.student_id
  left join lessons l on l.id = s.lesson_id
  where s.student_id = auth.uid() or public.is_teacher()
  order by s.created_at desc
$$;

-- 6. Lessons the student may see in outlines, with a lock flag
create or replace function public.lesson_catalog() returns table (
  course_id uuid, course_title text, grade text, lesson_id uuid, title text, "position" int, unlocked boolean
) language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.grade, l.id, l.title, l.position, public.has_lesson_access(l.id)
  from lessons l join courses c on c.id = l.course_id
  where c.published and (public.is_approved() or public.is_teacher())
  order by c.grade, c.title, l.position
$$;

-- 7. Lock lesson content, quizzes, progress and homework behind access
drop policy if exists l_r on public.lessons;
create policy l_r on public.lessons for select using (
  public.is_teacher() or (
    public.is_approved() and public.has_lesson_access(id)
    and exists (select 1 from courses c where c.id = lessons.course_id and c.published)
  )
);
drop policy if exists q_r on public.quizzes;
create policy q_r on public.quizzes for select using (
  public.is_teacher() or (
    public.is_approved() and public.has_lesson_access(lesson_id)
    and exists (select 1 from lessons l join courses c on c.id = l.course_id where l.id = quizzes.lesson_id and c.published)
  )
);
drop policy if exists hw_i on public.homework;
create policy hw_i on public.homework for insert
  with check (student_id = auth.uid() and public.is_approved() and public.has_lesson_access(lesson_id));
drop policy if exists pr_s on public.progress;
create policy pr_s on public.progress for all
  using (student_id = auth.uid() or public.is_teacher())
  with check (student_id = auth.uid() and public.is_approved() and public.has_lesson_access(lesson_id));

create or replace function public.submit_quiz(p_lesson uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_score int := 0; v_total int := 0; v_res jsonb := '[]'::jsonb; r record; a int;
begin
  if v_uid is null or not (is_approved() or is_teacher()) then raise exception 'not allowed'; end if;
  if not is_teacher() and not exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id where l.id = p_lesson and c.published) then
    raise exception 'not allowed';
  end if;
  if not public.has_lesson_access(p_lesson) then raise exception 'subscription required'; end if;
  for r in select id, correct from quizzes where lesson_id = p_lesson order by id loop
    v_total := v_total + 1;
    a := case when jsonb_typeof(p_answers -> r.id::text) = 'number' then (p_answers ->> r.id::text)::int else null end;
    if a is not null and a = r.correct then v_score := v_score + 1; end if;
    v_res := v_res || jsonb_build_object('id', r.id, 'correct', r.correct);
  end loop;
  if v_total = 0 then raise exception 'no quiz for this lesson'; end if;
  insert into quiz_results (student_id, lesson_id, score, total) values (v_uid, p_lesson, v_score, v_total);
  return jsonb_build_object('score', v_score, 'total', v_total, 'answers', v_res);
end $$;

-- 8. Private storage for receipt screenshots (3 MB, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists rc_ins on storage.objects;
drop policy if exists rc_sel on storage.objects;
create policy rc_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy rc_sel on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher()));

grant execute on function public.request_subscription(text, uuid, int, text, text, text) to authenticated;
grant execute on function public.list_subscriptions() to authenticated;
grant execute on function public.lesson_catalog() to authenticated;
grant select on public.subscriptions to authenticated;
grant update on public.subscriptions to authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
update public.site_settings set value = '150' where key = 'price_month' and value = '';
update public.site_settings set value = '50' where key = 'price_lesson' and value = '';
update public.site_settings set value = '01000000000' where key = 'payment_number' and value = '';
