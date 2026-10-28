-- ============================================================
-- ShuleMoja — Features pack (Deputy, school level, carry-forward,
-- promotion, referrals, richer audit helpers)
-- Run AFTER 01–06
-- ============================================================

-- 1) Extend staff roles to include Deputy Principal
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('Principal','Deputy Principal','Senior Teacher','Secretary','Teacher'));

-- 2) School level + CBC stage on grades + referral
alter table public.schools add column if not exists school_level text
  check (school_level is null or school_level in ('primary','secondary','combined'));
alter table public.schools add column if not exists referral_code text unique;
alter table public.schools add column if not exists referred_by_code text;
alter table public.schools add column if not exists pricing_plan text default 'trial';
-- plan already may exist as `plan` from v5
alter table public.schools add column if not exists subscription_interval text
  check (subscription_interval is null or subscription_interval in ('termly','yearly'));

alter table public.grades add column if not exists stage text;
-- stage examples: ecd, lower_primary, upper_primary, junior_secondary, senior_secondary

-- Referral agents (optional tracked referrers)
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  owner_name text,
  owner_email text,
  owner_phone text,
  school_id uuid references public.schools(id) on delete set null,
  reward_note text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.referral_signups (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  school_id uuid references public.schools(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.referrals enable row level security;
alter table public.referral_signups enable row level security;

drop policy if exists "ref platform" on public.referrals;
create policy "ref platform" on public.referrals for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "refsign platform" on public.referral_signups;
create policy "refsign platform" on public.referral_signups for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Ensure every school has a referral code
create or replace function public.ensure_school_referral_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := upper(substr(md5(random()::text || coalesce(new.id::text, '')), 1, 8));
  end if;
  return new;
end $$;

drop trigger if exists trg_school_referral on public.schools;
create trigger trg_school_referral
  before insert on public.schools
  for each row execute function public.ensure_school_referral_code();

update public.schools set referral_code = upper(substr(md5(id::text), 1, 8))
  where referral_code is null;

-- 3) Fee carry-forward when setting current term
create or replace function public.carry_forward_fee_arrears(
  p_school_id uuid,
  p_from_term_id uuid,
  p_to_term_id uuid
) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  term_fee numeric;
  paid numeric;
  arrears numeric;
  bal numeric;
  n int := 0;
begin
  if p_school_id is distinct from public.my_school_id()
     and not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  if public.my_role() not in ('Principal','Deputy Principal','Senior Teacher','Secretary')
     and not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;

  for r in
    select s.id as student_id, se.grade_id
    from public.students s
    left join public.student_enrollments se
      on se.student_id = s.id and se.term_id = p_from_term_id
    where s.school_id = p_school_id and s.status = 'Active'
  loop
    select coalesce(fs.total_fee, 0) into term_fee
      from public.fee_structures fs
      where fs.school_id = p_school_id and fs.term_id = p_from_term_id
        and fs.grade_id = r.grade_id;

    select coalesce(sum(amount), 0) into arrears
      from public.fee_opening_balances
      where school_id = p_school_id and term_id = p_from_term_id and student_id = r.student_id;

    select coalesce(sum(amount_paid), 0) into paid
      from public.fee_payments
      where school_id = p_school_id and term_id = p_from_term_id and student_id = r.student_id;

    bal := greatest(0, coalesce(term_fee,0) + coalesce(arrears,0) - coalesce(paid,0));

    insert into public.fee_opening_balances (school_id, student_id, term_id, amount, notes)
    values (p_school_id, r.student_id, p_to_term_id, bal, 'Auto carry-forward from previous term')
    on conflict (school_id, student_id, term_id)
    do update set amount = excluded.amount, notes = excluded.notes;

    n := n + 1;
  end loop;

  perform public.log_audit('fees.carry_forward', 'terms', p_to_term_id::text,
    jsonb_build_object('from', p_from_term_id, 'to', p_to_term_id, 'students', n), p_school_id);
  return n;
end $$;
grant execute on function public.carry_forward_fee_arrears(uuid, uuid, uuid) to authenticated;

-- 4) Promote students (batch)
create or replace function public.promote_students(
  p_school_id uuid,
  p_from_term_id uuid,
  p_to_term_id uuid,
  p_from_grade_id uuid,
  p_to_grade_id uuid,
  p_student_ids uuid[]
) returns int
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  n int := 0;
begin
  if p_school_id is distinct from public.my_school_id() then
    raise exception 'Not allowed';
  end if;
  if public.my_role() not in ('Principal','Deputy Principal','Senior Teacher') then
    raise exception 'Not allowed';
  end if;

  foreach sid in array p_student_ids loop
    insert into public.student_enrollments (school_id, student_id, term_id, grade_id)
    values (p_school_id, sid, p_to_term_id, p_to_grade_id)
    on conflict (school_id, student_id, term_id)
    do update set grade_id = excluded.grade_id;
    n := n + 1;
  end loop;

  perform public.log_audit('students.promote', 'grades', p_to_grade_id::text,
    jsonb_build_object('from_grade', p_from_grade_id, 'to_grade', p_to_grade_id,
      'from_term', p_from_term_id, 'to_term', p_to_term_id, 'count', n));
  return n;
end $$;
grant execute on function public.promote_students(uuid, uuid, uuid, uuid, uuid, uuid[]) to authenticated;

-- Seed CBC primary grades
create or replace function public.seed_cbc_primary_grades(p_school_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g text[][] := array[
    array['PP1', 'ecd'],
    array['PP2', 'ecd'],
    array['Grade 1', 'lower_primary'],
    array['Grade 2', 'lower_primary'],
    array['Grade 3', 'lower_primary'],
    array['Grade 4', 'upper_primary'],
    array['Grade 5', 'upper_primary'],
    array['Grade 6', 'upper_primary'],
    array['Grade 7', 'junior_secondary'],
    array['Grade 8', 'junior_secondary'],
    array['Grade 9', 'junior_secondary']
  ];
  i int;
begin
  if p_school_id is distinct from public.my_school_id() and not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  for i in 1..array_length(g, 1) loop
    insert into public.grades (school_id, grade_name, stage)
    values (p_school_id, g[i][1], g[i][2])
    on conflict (school_id, grade_name) do update set stage = excluded.stage;
  end loop;
end $$;
grant execute on function public.seed_cbc_primary_grades(uuid) to authenticated;

create or replace function public.seed_secondary_grades(p_school_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g text[][] := array[
    array['Form 1', 'senior_secondary'],
    array['Form 2', 'senior_secondary'],
    array['Form 3', 'senior_secondary'],
    array['Form 4', 'senior_secondary']
  ];
  i int;
begin
  if p_school_id is distinct from public.my_school_id() and not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  for i in 1..array_length(g, 1) loop
    insert into public.grades (school_id, grade_name, stage)
    values (p_school_id, g[i][1], g[i][2])
    on conflict (school_id, grade_name) do update set stage = excluded.stage;
  end loop;
end $$;
grant execute on function public.seed_secondary_grades(uuid) to authenticated;

-- Broaden my_role helpers used in policies: update key policies to include Deputy Principal
-- Re-apply critical admin policies with Deputy
do $$
begin
  -- schools update
  drop policy if exists "admins edit school" on public.schools;
  create policy "admins edit school" on public.schools for update
    using (id = public.my_school_id() and public.my_role() in ('Principal','Deputy Principal','Senior Teacher'));

  drop policy if exists "admins manage staff" on public.users;
  create policy "admins manage staff" on public.users for update
    using (school_id = public.my_school_id() and public.my_role() in ('Principal','Deputy Principal','Senior Teacher') and id <> auth.uid())
    with check (school_id = public.my_school_id());
exception when others then
  raise notice 'policy refresh: %', sqlerrm;
end $$;

-- Signup: accept school_level + referral on new school (patch staff inline)
create or replace function public.handle_new_staff_inline(uid uuid, uemail text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; code text; r text; lvl text; ref text;
begin
  if coalesce(meta->>'school_name','') <> '' then
    loop
      code := upper(substr(md5(random()::text), 1, 6));
      exit when not exists (select 1 from public.schools where school_code = code);
    end loop;
    lvl := meta->>'school_level';
    if lvl not in ('primary','secondary','combined') then lvl := 'primary'; end if;
    ref := nullif(trim(coalesce(meta->>'referral_code','')), '');
    insert into public.schools (school_name, school_code, school_level, referred_by_code)
      values (trim(meta->>'school_name'), code, lvl, ref) returning id into sid;
    if ref is not null then
      insert into public.referral_signups (referral_code, school_id) values (upper(ref), sid);
    end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Principal'), 'Principal', 'active');
  else
    select id into sid from public.schools where school_code = upper(trim(coalesce(meta->>'school_code','')));
    if sid is null then
      raise exception 'Invalid school details';
    end if;
    r := meta->>'role';
    if r not in ('Teacher','Secretary','Deputy Principal','Senior Teacher') then r := 'Teacher'; end if;
    -- still block self-select Principal on join
    if r = 'Principal' then r := 'Teacher'; end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Staff'), r, 'pending');
  end if;
end $$;
