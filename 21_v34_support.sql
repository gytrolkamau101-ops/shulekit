-- ShuleMoja v34 — in-app support tickets (Premium schools → platform admin)
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  body text not null,
  channel text default 'in_app',
  status text not null default 'open',
  media_url text,
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_school on public.support_tickets(school_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

alter table public.support_tickets enable row level security;

drop policy if exists "support school read" on public.support_tickets;
create policy "support school read" on public.support_tickets for select
  using (
    school_id = public.my_school_id()
    or public.is_platform_admin()
  );

drop policy if exists "support school insert" on public.support_tickets;
create policy "support school insert" on public.support_tickets for insert
  with check (
    school_id = public.my_school_id()
  );

drop policy if exists "support admin update" on public.support_tickets;
create policy "support admin update" on public.support_tickets for update
  using (public.is_platform_admin());
