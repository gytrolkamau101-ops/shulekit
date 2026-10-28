-- ============================================================
-- ShuleMoja schema  (run ONCE in Supabase > SQL Editor)
-- Includes: tables, sign-up trigger, role-based security (RLS)
-- ============================================================

-- ---------- TABLES ----------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  school_code text unique not null,
  location text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('Principal','Senior Teacher','Secretary','Teacher')),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  phone text,
  created_at timestamptz default now()
);

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  year int not null,
  term int not null check (term in (1,2,3)),
  start_date date not null,
  end_date date not null,
  is_current boolean default false,
  created_at timestamptz default now(),
  unique (school_id, year, term)
);
create unique index one_current_term_per_school on public.terms(school_id) where is_current;

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_name text not null,
  class_teacher_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (school_id, grade_name)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  admission_no text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text check (gender in ('Male','Female')),
  parent_name text,
  parent_phone text,
  parent_email text,
  date_admitted date not null default current_date,
  status text default 'Active' check (status in ('Active','Inactive','Alumni')),
  created_at timestamptz default now(),
  unique (school_id, admission_no)
);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete cascade,
  created_at timestamptz default now(),
  unique (school_id, student_id, term_id)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_name text not null,
  code text,
  created_at timestamptz default now(),
  unique (school_id, subject_name)
);

create table public.subject_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  created_at timestamptz default now(),
  unique (grade_id, subject_id, term_id)
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_name text not null,
  term_id uuid not null references public.terms(id) on delete cascade,
  exam_date date,
  created_at timestamptz default now()
);

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  marks_obtained numeric(5,2),
  total_marks numeric(5,2) default 100,
  grade text,
  comments text,
  entered_by uuid references public.users(id) on delete set null,
  updated_at timestamptz default now(),
  unique (exam_id, student_id, subject_id)
);

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete cascade,
  total_fee numeric(10,2) not null default 0,
  created_at timestamptz default now(),
  unique (school_id, term_id, grade_id)
);

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  amount_paid numeric(10,2) not null check (amount_paid > 0),
  payment_date date not null default current_date,
  payment_method text,
  receipt_no text,
  notes text,
  created_at timestamptz default now(),
  unique (school_id, receipt_no)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  status text check (status in ('Present','Absent','Late','Excused')),
  remarks text,
  created_at timestamptz default now(),
  unique (school_id, student_id, date)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  expense_type text not null,
  amount numeric(10,2) not null check (amount > 0),
  expense_date date not null default current_date,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

create table public.school_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  event_name text not null,
  event_date date not null,
  description text,
  created_at timestamptz default now()
);

create table public.school_resources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  resource_name text not null,
  resource_type text,
  quantity int default 1,
  year int,
  condition text,
  notes text,
  created_at timestamptz default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  created_at timestamptz default now()
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  submission_date timestamptz,
  marks_obtained numeric(5,2),
  feedback text,
  updated_at timestamptz default now(),
  unique (assignment_id, student_id)
);

create index on public.users(school_id);
create index on public.students(school_id);
create index on public.student_enrollments(term_id, grade_id);
create index on public.exam_results(exam_id, subject_id);
create index on public.fee_payments(student_id, term_id);
create index on public.attendance(student_id);

-- ---------- HELPER FUNCTIONS ----------
-- Return the signed-in user's school / role. Return NULL while the account is
-- still pending approval, so pending users can see nothing (fails closed).
create or replace function public.my_school_id() returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from public.users where id = auth.uid() and status = 'active'
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid() and status = 'active'
$$;

-- Lets the sign-up form confirm which school a code belongs to
create or replace function public.school_name_for_code(code text) returns text
language sql stable security definer set search_path = public as $$
  select school_name from public.schools where school_code = upper(trim(code))
$$;
grant execute on function public.school_name_for_code(text) to anon, authenticated;

-- ---------- SIGN-UP TRIGGER ----------
-- New school  : user becomes Principal, ACTIVE immediately, school code generated.
-- Join school : user is created as PENDING until Principal / Senior Teacher approves.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  sid uuid; code text; r text;
begin
  if coalesce(meta->>'school_name','') <> '' then
    loop
      code := upper(substr(md5(random()::text), 1, 6));
      exit when not exists (select 1 from public.schools where school_code = code);
    end loop;
    insert into public.schools (school_name, school_code)
      values (trim(meta->>'school_name'), code) returning id into sid;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (new.id, sid, new.email, coalesce(nullif(meta->>'full_name',''), 'Principal'), 'Principal', 'active');
  else
    select id into sid from public.schools where school_code = upper(trim(coalesce(meta->>'school_code','')));
    if sid is null then
      raise exception 'School code not found';
    end if;
    r := meta->>'role';
    if r not in ('Principal','Senior Teacher','Secretary','Teacher') then r := 'Teacher'; end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (new.id, sid, new.email, coalesce(nullif(meta->>'full_name',''), 'Staff'), r, 'pending');
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ROW LEVEL SECURITY ----------
alter table public.schools enable row level security;
alter table public.users enable row level security;

create policy "own school" on public.schools for select
  using (id = public.my_school_id());
create policy "admins edit school" on public.schools for update
  using (id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher'));

create policy "see self and school staff" on public.users for select
  using (id = auth.uid() or school_id = public.my_school_id());
create policy "admins manage staff" on public.users for update
  using (school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher') and id <> auth.uid())
  with check (school_id = public.my_school_id());

-- Every other table: (read roles) can SELECT, (write roles) can do everything,
-- and only inside the user's own school.
do $$
declare
  r record;
  allr text[] := array['Principal','Senior Teacher','Secretary','Teacher'];
  adm  text[] := array['Principal','Senior Teacher'];
begin
  for r in select * from (values
    ('terms',               allr,                                 adm),
    ('grades',              allr,                                 adm),
    ('subjects',            allr,                                 adm),
    ('subject_allocations', allr,                                 adm),
    ('students',            allr,                                 array['Principal','Senior Teacher','Secretary']),
    ('student_enrollments', allr,                                 array['Principal','Senior Teacher','Secretary']),
    ('fee_structures',      array['Principal','Senior Teacher','Secretary'], adm),
    ('fee_payments',        array['Principal','Senior Teacher','Secretary'], array['Principal','Senior Teacher','Secretary']),
    ('exams',               array['Principal','Senior Teacher','Teacher'],   array['Principal','Senior Teacher','Teacher']),
    ('exam_results',        array['Principal','Senior Teacher','Teacher'],   array['Principal','Senior Teacher','Teacher']),
    ('attendance',          allr,                                 array['Principal','Senior Teacher','Teacher']),
    ('expenses',            adm,                                  adm),
    ('school_events',       allr,                                 array['Principal','Senior Teacher','Secretary']),
    ('school_resources',    array['Principal','Senior Teacher','Secretary'], array['Principal','Senior Teacher','Secretary']),
    ('assignments',         array['Principal','Senior Teacher','Teacher'],   array['Principal','Senior Teacher','Teacher']),
    ('assignment_submissions', array['Principal','Senior Teacher','Teacher'], array['Principal','Senior Teacher','Teacher'])
  ) as t(tbl, read_roles, write_roles)
  loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format($p$create policy "read" on public.%I for select
      using (school_id = public.my_school_id() and public.my_role() = any(%L::text[]))$p$, r.tbl, r.read_roles);
    execute format($p$create policy "write" on public.%I for all
      using (school_id = public.my_school_id() and public.my_role() = any(%L::text[]))
      with check (school_id = public.my_school_id() and public.my_role() = any(%L::text[]))$p$,
      r.tbl, r.write_roles, r.write_roles);
  end loop;
end $$;
