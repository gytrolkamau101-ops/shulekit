-- ============================================================
-- ShuleMoja — Parent Portal migration (run AFTER 01_schema.sql)
-- Adds: parent accounts, parent-child linking (admin-approved),
-- and read-only RLS so a parent only ever sees their own child.
-- ============================================================

create table public.parents (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz default now()
);

create table public.parent_children (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  unique (parent_id, student_id)
);

create index on public.parents(school_id);
create index on public.parent_children(student_id);
create index on public.parent_children(parent_id);

-- ---------- helper: which students this parent may see ----------
create or replace function public.my_approved_children() returns setof uuid
language sql stable security definer set search_path = public as $$
  select student_id from public.parent_children
  where parent_id = auth.uid() and status = 'approved'
    and exists (select 1 from public.parents where id = auth.uid() and status = 'active')
$$;
grant execute on function public.my_approved_children() to authenticated;

-- ---------- sign-up trigger addition ----------
-- A parent signs up with: full_name, parent_signup = true, school_code, admission_no.
-- We verify the admission number exists in that school, then create a pending
-- parent + pending link. Staff approve both from School Setup > Parents.
-- Replace the single staff trigger with one that routes to staff or parent signup
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user_router() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(meta->>'parent_signup','') = 'true' then
    perform public.handle_new_parent_inline(new.id, new.email, meta);
  else
    perform public.handle_new_staff_inline(new.id, new.email, meta);
  end if;
  return new;
end $$;

-- Wrap the original staff logic as a callable function (keeps 01_schema.sql's
-- handle_new_user body, just renamed so the router can call it)
create or replace function public.handle_new_staff_inline(uid uuid, uemail text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
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
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Principal'), 'Principal', 'active');
  else
    select id into sid from public.schools where school_code = upper(trim(coalesce(meta->>'school_code','')));
    if sid is null then
      raise exception 'School code not found';
    end if;
    r := meta->>'role';
    if r not in ('Principal','Senior Teacher','Secretary','Teacher') then r := 'Teacher'; end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Staff'), r, 'pending');
  end if;
end $$;

create or replace function public.handle_new_parent_inline(uid uuid, uemail text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; stu_id uuid;
begin
  select id into sid from public.schools where school_code = upper(trim(coalesce(meta->>'school_code','')));
  if sid is null then
    raise exception 'School code not found';
  end if;

  select id into stu_id from public.students
    where school_id = sid and admission_no = trim(coalesce(meta->>'admission_no',''));
  if stu_id is null then
    raise exception 'No student found with that admission number at this school';
  end if;

  insert into public.parents (id, school_id, full_name, email, status)
    values (uid, sid, coalesce(nullif(meta->>'full_name',''), 'Parent'), uemail, 'pending');

  insert into public.parent_children (school_id, parent_id, student_id, status)
    values (sid, uid, stu_id, 'pending');
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_router();

-- ---------- RLS ----------
alter table public.parents enable row level security;
alter table public.parent_children enable row level security;

create policy "parent sees self" on public.parents for select
  using (id = auth.uid() or school_id = public.my_school_id());
create policy "staff manage parents" on public.parents for update
  using (school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher','Secretary'));

create policy "parent sees own links" on public.parent_children for select
  using (parent_id = auth.uid() or school_id = public.my_school_id());
create policy "staff manage parent links" on public.parent_children for all
  using (school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher','Secretary'))
  with check (school_id = public.my_school_id());

-- Parents get read-only access to their approved children's records,
-- layered on top of (not replacing) the existing staff policies.
create policy "parent reads own children" on public.students for select
  using (id in (select public.my_approved_children()));

create policy "parent reads own children fees" on public.fee_payments for select
  using (student_id in (select public.my_approved_children()));

create policy "parent reads own children results" on public.exam_results for select
  using (student_id in (select public.my_approved_children()));

create policy "parent reads own children attendance" on public.attendance for select
  using (student_id in (select public.my_approved_children()));

create policy "parent reads fee structures" on public.fee_structures for select
  using (school_id in (select school_id from public.parent_children where parent_id = auth.uid() and status = 'approved'));

create policy "parent reads own school terms" on public.terms for select
  using (school_id in (select school_id from public.parent_children where parent_id = auth.uid() and status = 'approved'));
