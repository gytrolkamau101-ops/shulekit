-- ShuleMoja v10 — fee heads, circulars, admissions (run after 01–09)

create table if not exists public.fee_heads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  head_name text not null,
  created_at timestamptz default now(),
  unique (school_id, head_name)
);

create table if not exists public.fee_structure_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  grade_id uuid not null references public.grades(id) on delete cascade,
  head_id uuid not null references public.fee_heads(id) on delete cascade,
  amount numeric not null default 0,
  unique (term_id, grade_id, head_id)
);

create table if not exists public.circulars (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  body text not null,
  audience text default 'all' check (audience in ('all','parents','staff')),
  published_at timestamptz default now(),
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  gender text,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  guardian_email text,
  applying_grade text,
  status text default 'enquiry' check (status in ('enquiry','interview','accepted','rejected','enrolled')),
  notes text,
  created_at timestamptz default now()
);

create index if not exists circulars_school on public.circulars(school_id, published_at desc);
create index if not exists admissions_school on public.admissions(school_id, status);

alter table public.fee_heads enable row level security;
alter table public.fee_structure_items enable row level security;
alter table public.circulars enable row level security;
alter table public.admissions enable row level security;

drop policy if exists "fh school" on public.fee_heads;
create policy "fh school" on public.fee_heads for all
  using (school_id = public.my_school_id()) with check (school_id = public.my_school_id());

drop policy if exists "fsi school" on public.fee_structure_items;
create policy "fsi school" on public.fee_structure_items for all
  using (school_id = public.my_school_id()) with check (school_id = public.my_school_id());

drop policy if exists "cir school" on public.circulars;
create policy "cir school" on public.circulars for all
  using (school_id = public.my_school_id()) with check (school_id = public.my_school_id());

drop policy if exists "adm school" on public.admissions;
create policy "adm school" on public.admissions for all
  using (school_id = public.my_school_id()) with check (school_id = public.my_school_id());

-- Parents can read circulars for their school (via approved link)
drop policy if exists "cir parent read" on public.circulars;
create policy "cir parent read" on public.circulars for select
  using (
    school_id = public.my_school_id()
    or exists (
      select 1 from public.parent_children pc
      join public.students st on st.id = pc.student_id
      where pc.parent_id = auth.uid() and pc.status = 'approved' and st.school_id = circulars.school_id
    )
  );
