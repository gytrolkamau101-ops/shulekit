-- ShuleMoja v5 remaining features (run AFTER 07)
-- Payment rails config, messaging log, plan helpers

alter table public.schools add column if not exists mpesa_paybill text;
alter table public.schools add column if not exists mpesa_account_ref text;
alter table public.schools add column if not exists intasend_publishable_key text;
alter table public.schools add column if not exists fee_payment_instructions text;
alter table public.schools add column if not exists student_cap int default 500;

create table if not exists public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  channel text not null check (channel in ('sms','whatsapp','email','copy')),
  recipient text,
  body text not null,
  related_student_id uuid references public.students(id) on delete set null,
  status text default 'draft' check (status in ('draft','copied','sent','failed')),
  created_by uuid,
  created_at timestamptz default now()
);

create index if not exists msg_outbox_school on public.message_outbox(school_id, created_at desc);

alter table public.message_outbox enable row level security;
drop policy if exists "msg read" on public.message_outbox;
drop policy if exists "msg write" on public.message_outbox;
create policy "msg read" on public.message_outbox for select
  using (school_id = public.my_school_id());
create policy "msg write" on public.message_outbox for all
  using (school_id = public.my_school_id() and public.my_role() in
    ('Principal','Deputy Principal','Senior Teacher','Secretary'))
  with check (school_id = public.my_school_id());

-- Soft plan check (returns true if school may use app)
create or replace function public.school_plan_ok(p_school_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case
       when coalesce(is_suspended, false) then false
       when plan_expires_at is not null and plan_expires_at < now() then false
       else true
     end
     from public.schools where id = p_school_id),
    false
  )
$$;
grant execute on function public.school_plan_ok(uuid) to authenticated;
