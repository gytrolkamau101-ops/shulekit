-- ============================================================
-- ShuleMoja (run AFTER 01–04)
-- Subject baskets, resource files, timetables, fee balance view
-- ============================================================

-- Subject baskets (e.g. Sciences, Languages)
create table if not exists public.subject_baskets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  basket_name text not null,
  description text,
  created_at timestamptz default now(),
  unique (school_id, basket_name)
);

create table if not exists public.subject_basket_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  basket_id uuid not null references public.subject_baskets(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  unique (basket_id, subject_id)
);

-- Assign basket (or optional individual subjects already via subject_allocations) to grade+term
create table if not exists public.grade_basket_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete cascade,
  basket_id uuid not null references public.subject_baskets(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  unique (grade_id, basket_id, term_id)
);

-- Enhance resources for file storage paths
alter table public.school_resources add column if not exists file_url text;
alter table public.school_resources add column if not exists storage_path text;
alter table public.school_resources add column if not exists file_size int;

-- Timetable
create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7), -- 1=Mon
  period_no int not null check (period_no between 1 and 12),
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid references public.users(id) on delete set null,
  room text,
  created_at timestamptz default now(),
  unique (school_id, term_id, grade_id, day_of_week, period_no)
);

-- Fee arrears carry note: optional opening balance per student/term
create table if not exists public.fee_opening_balances (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz default now(),
  unique (school_id, student_id, term_id)
);

create index if not exists idx_timetable_grade on public.timetable_slots(grade_id, term_id);
create index if not exists idx_basket_items on public.subject_basket_items(basket_id);

-- RLS
do $$
declare
  r record;
  allr text[] := array['Principal','Senior Teacher','Secretary','Teacher'];
  adm  text[] := array['Principal','Senior Teacher'];
begin
  for r in select * from (values
    ('subject_baskets', allr, adm),
    ('subject_basket_items', allr, adm),
    ('grade_basket_assignments', allr, adm),
    ('timetable_slots', allr, array['Principal','Senior Teacher','Teacher']),
    ('fee_opening_balances', array['Principal','Senior Teacher','Secretary'], array['Principal','Senior Teacher','Secretary'])
  ) as t(tbl, read_roles, write_roles)
  loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('drop policy if exists "read" on public.%I', r.tbl);
    execute format('drop policy if exists "write" on public.%I', r.tbl);
    execute format($p$create policy "read" on public.%I for select
      using (school_id = public.my_school_id() and public.my_role() = any(%L::text[]))$p$, r.tbl, r.read_roles);
    execute format($p$create policy "write" on public.%I for all
      using (school_id = public.my_school_id() and public.my_role() = any(%L::text[]))
      with check (school_id = public.my_school_id() and public.my_role() = any(%L::text[]))$p$,
      r.tbl, r.write_roles, r.write_roles);
  end loop;
end $$;

-- Parent read timetable for own children's grades (via enrollment)
drop policy if exists "parent reads timetable" on public.timetable_slots;
create policy "parent reads timetable" on public.timetable_slots for select
  using (
    grade_id in (
      select se.grade_id from public.student_enrollments se
      where se.student_id in (select public.my_approved_children())
    )
  );
