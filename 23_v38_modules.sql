-- ShuleMoja v38 modules: boarding, transport, BOM, records, staff desk
-- Requires 22_v37_streams_status.sql

-- Boarding
create table if not exists public.boarding_houses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  house_name text not null,
  capacity int default 0,
  matron_name text,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.boarding_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  house_id uuid references public.boarding_houses(id) on delete set null,
  bed_label text,
  status text default 'active',
  notes text,
  created_at timestamptz not null default now()
);

-- Transport
create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plate text not null,
  vehicle_name text,
  capacity int default 0,
  driver_name text,
  driver_phone text,
  status text default 'active',
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.transport_trips (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  vehicle_id uuid references public.fleet_vehicles(id) on delete set null,
  trip_date date not null default current_date,
  destination text,
  purpose text,
  expense_amount numeric(12,2) default 0,
  expense_notes text,
  driver_summary text,
  status text default 'planned',
  created_by uuid,
  created_at timestamptz not null default now()
);

-- BOM
create table if not exists public.bom_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  body text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.bom_polls (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]',
  closes_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.bom_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.bom_polls(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  voter_key text not null,
  choice text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_key)
);

-- Records vault
create table if not exists public.school_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  category text not null default 'other',
  title text not null,
  notes text,
  file_url text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Staff desk (kitchen, watchman, etc.)
create table if not exists public.staff_desk_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  desk_role text not null,
  title text not null,
  body text,
  entry_date date default current_date,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Caps on schools
alter table public.schools add column if not exists staff_cap int;
alter table public.schools add column if not exists parent_cap int;

-- RLS helpers
do $$
declare
  t text;
begin
  foreach t in array array[
    'boarding_houses','boarding_assignments','fleet_vehicles','transport_trips',
    'bom_announcements','bom_polls','bom_votes','school_records','staff_desk_entries'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_school', t);
    execute format(
      'create policy %I on public.%I for all using (school_id = public.my_school_id()) with check (school_id = public.my_school_id())',
      t||'_school', t
    );
  end loop;
end $$;
