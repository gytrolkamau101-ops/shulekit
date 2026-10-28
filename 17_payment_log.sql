-- Payment audit log enhancements
alter table public.subscription_events add column if not exists kind text;
alter table public.subscription_events add column if not exists phone_masked text;
alter table public.subscription_events add column if not exists error_message text;
alter table public.subscription_events add column if not exists student_id uuid;
alter table public.subscription_events add column if not exists updated_at timestamptz default now();

create index if not exists sub_events_state on public.subscription_events(state);
create index if not exists sub_events_created on public.subscription_events(created_at desc);

-- Principals can read payment events for their school (optional visibility)
-- FIXED: this referenced a `public.profiles` table that doesn't exist
-- anywhere in the schema (staff live in `public.users`). As written this
-- statement errors, which rolls back the whole file — including the
-- `alter table` columns above — since Supabase's SQL editor runs a pasted
-- script as one transaction.
drop policy if exists "sub events school read" on public.subscription_events;
create policy "sub events school read" on public.subscription_events for select
  using (
    school_id is not null
    and school_id = public.my_school_id()
    and public.my_role() in ('Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary')
  );
