-- ============================================================
-- ShuleKit features (run AFTER 01, 02, 03)
-- - Grade scales (CBC BE/ME/AE or custom)
-- - Audit log
-- - Platform super-admins
-- - School subscription fields
-- ============================================================

-- Grade scale definitions per school
create table if not exists public.grade_scales (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  scale_name text not null default 'Default',
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (school_id, scale_name)
);

-- Bands: e.g. BE 0-49, ME 50-69, AE 70-100 or A 80-100
create table if not exists public.grade_bands (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  scale_id uuid not null references public.grade_scales(id) on delete cascade,
  label text not null,           -- BE, ME, AE, EE or A, B, C...
  min_pct numeric(5,2) not null,
  max_pct numeric(5,2) not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create index if not exists grade_bands_scale on public.grade_bands(scale_id);

-- Append-only audit
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text,
  entity_id text,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists audit_events_school on public.audit_events(school_id, created_at desc);
create index if not exists audit_events_created on public.audit_events(created_at desc);

-- Platform operators (you)
create table if not exists public.platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);

-- Subscription fields on schools
alter table public.schools add column if not exists plan text default 'free';
alter table public.schools add column if not exists plan_expires_at timestamptz;
alter table public.schools add column if not exists is_suspended boolean default false;

-- RLS
alter table public.grade_scales enable row level security;
alter table public.grade_bands enable row level security;
alter table public.audit_events enable row level security;
alter table public.platform_admins enable row level security;

drop policy if exists "gs read" on public.grade_scales;
drop policy if exists "gs write" on public.grade_scales;
create policy "gs read" on public.grade_scales for select
  using (school_id = public.my_school_id());
create policy "gs write" on public.grade_scales for all
  using (school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher'))
  with check (school_id = public.my_school_id());

drop policy if exists "gb read" on public.grade_bands;
drop policy if exists "gb write" on public.grade_bands;
create policy "gb read" on public.grade_bands for select
  using (school_id = public.my_school_id());
create policy "gb write" on public.grade_bands for all
  using (school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher'))
  with check (school_id = public.my_school_id());

-- School staff can insert audit rows for their school; only platform can read all
drop policy if exists "audit insert school" on public.audit_events;
drop policy if exists "audit read school" on public.audit_events;
create policy "audit insert school" on public.audit_events for insert
  with check (
    school_id = public.my_school_id()
    or exists (select 1 from public.platform_admins where id = auth.uid())
  );
create policy "audit read school" on public.audit_events for select
  using (
    school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher')
    or exists (select 1 from public.platform_admins where id = auth.uid())
  );

drop policy if exists "pa self" on public.platform_admins;
create policy "pa self" on public.platform_admins for select
  using (id = auth.uid());

-- Helper: is platform admin
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where id = auth.uid())
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- Platform can list schools
drop policy if exists "platform lists schools" on public.schools;
create policy "platform lists schools" on public.schools for select
  using (public.is_platform_admin());

drop policy if exists "platform updates schools" on public.schools;
create policy "platform updates schools" on public.schools for update
  using (public.is_platform_admin());

-- RPC: log audit (security definer so it always works)
create or replace function public.log_audit(
  p_action text,
  p_entity text default null,
  p_entity_id text default null,
  p_detail jsonb default '{}'::jsonb,
  p_school_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  sid := coalesce(p_school_id, public.my_school_id());
  insert into public.audit_events (school_id, actor_id, actor_email, action, entity, entity_id, detail)
  values (
    sid,
    auth.uid(),
    coalesce((select email from auth.users where id = auth.uid()), ''),
    p_action,
    p_entity,
    p_entity_id,
    coalesce(p_detail, '{}'::jsonb)
  );
end $$;
grant execute on function public.log_audit(text, text, text, jsonb, uuid) to authenticated;

-- Seed CBC bands helper (call from app or once per school)
create or replace function public.seed_cbc_scale(p_school_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  if p_school_id is distinct from public.my_school_id()
     and not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  insert into public.grade_scales (school_id, scale_name, is_active)
  values (p_school_id, 'CBC', true)
  on conflict (school_id, scale_name) do update set is_active = true
  returning id into sid;

  delete from public.grade_bands where scale_id = sid;
  insert into public.grade_bands (school_id, scale_id, label, min_pct, max_pct, sort_order) values
    (p_school_id, sid, 'BE', 0, 39.99, 1),
    (p_school_id, sid, 'AE', 40, 59.99, 2),
    (p_school_id, sid, 'ME', 60, 79.99, 3),
    (p_school_id, sid, 'EE', 80, 100, 4);
  -- CBC: Below / Approaching / Meeting / Exceeding — schools can edit bands in Setup
  return sid;
end $$;
grant execute on function public.seed_cbc_scale(uuid) to authenticated;

-- Seed classic A-E
create or replace function public.seed_classic_scale(p_school_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  if p_school_id is distinct from public.my_school_id()
     and not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  insert into public.grade_scales (school_id, scale_name, is_active)
  values (p_school_id, 'Classic A-E', true)
  on conflict (school_id, scale_name) do update set is_active = true
  returning id into sid;
  delete from public.grade_bands where scale_id = sid;
  insert into public.grade_bands (school_id, scale_id, label, min_pct, max_pct, sort_order) values
    (p_school_id, sid, 'E', 0, 39.99, 1),
    (p_school_id, sid, 'D', 40, 49.99, 2),
    (p_school_id, sid, 'C', 50, 59.99, 3),
    (p_school_id, sid, 'B', 60, 69.99, 4),
    (p_school_id, sid, 'A', 70, 100, 5);
  return sid;
end $$;
grant execute on function public.seed_classic_scale(uuid) to authenticated;

-- Resolve letter grade from pct for school
create or replace function public.letter_for_pct(p_school_id uuid, p_pct numeric) returns text
language sql stable security definer set search_path = public as $$
  select gb.label
  from public.grade_bands gb
  join public.grade_scales gs on gs.id = gb.scale_id
  where gs.school_id = p_school_id and gs.is_active = true
    and p_pct >= gb.min_pct and p_pct <= gb.max_pct
  order by gb.sort_order
  limit 1
$$;
grant execute on function public.letter_for_pct(uuid, numeric) to authenticated;
