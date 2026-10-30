
-- Optional teacher on class subject checklist; Games module
alter table public.subject_allocations alter column teacher_id drop not null;

create table if not exists public.games_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  event_date date,
  opponent text,
  venue text,
  sport text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.games_assets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  item_name text not null,
  quantity int default 1,
  condition text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.games_players (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  sport text,
  active boolean default true,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.games_expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid references public.terms(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null default 0,
  expense_date date default current_date,
  created_at timestamptz default now()
);

alter table public.exam_results add column if not exists teacher_remark text;
alter table public.exam_results add column if not exists head_remark text;
