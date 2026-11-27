-- Payments gate: payments stay closed until the teacher sets a real transfer number and turns them on.
-- While closed: the bot takes no requests, and approved students keep lesson access. Safe to run more than once.
-- Run after subscriptions.sql, once, in the Supabase SQL editor.

insert into public.site_settings (key, value) values ('payments_enabled', 'off') on conflict (key) do nothing;

create or replace function public.payments_open() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select btrim(value) from site_settings where key = 'payments_enabled'), 'off') = 'on'
     and coalesce((select btrim(value) from site_settings where key = 'payment_number'), '') not in ('', '01000000000')
$$;
grant execute on function public.payments_open() to anon, authenticated;

-- Lesson access: open for approved students while payments are closed, subscription-based once open.
create or replace function public.has_lesson_access(p_lesson uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_teacher() or (
    public.is_approved() and (
      not public.payments_open() or exists (
        select 1 from subscriptions s
        where s.student_id = auth.uid() and public.sub_live(s) and (s.plan = 'month' or s.lesson_id = p_lesson)
      )
    )
  )
$$;

-- Requests: keep the original bot as request_subscription_open (not callable by users) behind a gate.
do $$ begin
  if to_regprocedure('public.request_subscription_open(text,uuid,integer,text,text,text)') is null then
    alter function public.request_subscription(text, uuid, int, text, text, text) rename to request_subscription_open;
  end if;
end $$;
revoke execute on function public.request_subscription_open(text, uuid, int, text, text, text) from public, anon, authenticated;

create or replace function public.request_subscription(
  p_plan text, p_lesson uuid, p_amount int, p_reference text, p_receipt_path text, p_receipt_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not allowed'; end if;
  if not public.payments_open() then
    return jsonb_build_object('ok', false, 'code', 'payments_closed', 'message', 'الاشتراك هيتفتح قريبًا. لحد وقتها الدروس مفتوحة للطلبة المقبولين.');
  end if;
  return public.request_subscription_open(p_plan, p_lesson, p_amount, p_reference, p_receipt_path, p_receipt_hash);
end $$;
grant execute on function public.request_subscription(text, uuid, int, text, text, text) to authenticated;
