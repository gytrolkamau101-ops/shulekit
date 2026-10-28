-- ============================================================
-- ShuleMoja — Security hardenings (run AFTER 01 + 02)
-- Fixes:
--  1. Suspended parents could still read terms / fee structures
--  2. Parents lacked SELECT on enrollments/exams/subjects/grades
--     (portal joins fail under RLS)
--  3. Staff self-selecting Principal/Senior Teacher on join
--  4. Admission-number oracle error messages
--  5. Case-insensitive admission matching
-- ============================================================

-- ---- Active parent helper (fails closed) ----
create or replace function public.my_parent_school_id() returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from public.parents
  where id = auth.uid() and status = 'active'
$$;

create or replace function public.my_approved_children() returns setof uuid
language sql stable security definer set search_path = public as $$
  select pc.student_id
  from public.parent_children pc
  join public.parents p on p.id = pc.parent_id
  where pc.parent_id = auth.uid()
    and pc.status = 'approved'
    and p.status = 'active'
$$;

-- Replace leaky parent policies on terms / fee_structures
drop policy if exists "parent reads fee structures" on public.fee_structures;
drop policy if exists "parent reads own school terms" on public.terms;

create policy "parent reads fee structures" on public.fee_structures for select
  using (school_id = public.my_parent_school_id());

create policy "parent reads own school terms" on public.terms for select
  using (school_id = public.my_parent_school_id());

-- Parent read access needed by ParentPortal joins
drop policy if exists "parent reads own enrollments" on public.student_enrollments;
create policy "parent reads own enrollments" on public.student_enrollments for select
  using (student_id in (select public.my_approved_children()));

drop policy if exists "parent reads exams" on public.exams;
create policy "parent reads exams" on public.exams for select
  using (school_id = public.my_parent_school_id());

drop policy if exists "parent reads subjects" on public.subjects;
create policy "parent reads subjects" on public.subjects for select
  using (school_id = public.my_parent_school_id());

drop policy if exists "parent reads grades" on public.grades;
create policy "parent reads grades" on public.grades for select
  using (school_id = public.my_parent_school_id());

-- Parents must not write anything on school data tables (explicit deny not needed;
-- no INSERT/UPDATE policies for parents = blocked by default when RLS on)

-- ---- Harden signup: staff cannot claim Principal/Senior Teacher on join ----
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
      raise exception 'Invalid school details';
    end if;
    -- Only Teacher or Secretary may be requested at signup. Elevation is staff-only.
    r := meta->>'role';
    if r not in ('Teacher','Secretary') then r := 'Teacher'; end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Staff'), r, 'pending');
  end if;
end $$;

-- ---- Harden parent signup: generic errors + case-insensitive adm no ----
create or replace function public.handle_new_parent_inline(uid uuid, uemail text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; stu_id uuid;
begin
  select id into sid from public.schools where school_code = upper(trim(coalesce(meta->>'school_code','')));
  if sid is null then
    raise exception 'Unable to complete registration. Check school code and admission number.';
  end if;

  select id into stu_id from public.students
    where school_id = sid
      and lower(trim(admission_no)) = lower(trim(coalesce(meta->>'admission_no','')));
  if stu_id is null then
    -- Same message as bad school code — avoids admission-number enumeration
    raise exception 'Unable to complete registration. Check school code and admission number.';
  end if;

  insert into public.parents (id, school_id, full_name, email, status)
    values (uid, sid, coalesce(nullif(meta->>'full_name',''), 'Parent'), uemail, 'pending');

  insert into public.parent_children (school_id, parent_id, student_id, status)
    values (sid, uid, stu_id, 'pending');
end $$;

-- Ensure router still points correctly
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

-- Staff must not change their own role/status (already id <> auth.uid on update)
-- Also prevent elevating beyond what admins set: with check keeps school_id fixed

-- Tighten parent_children staff policy: require active admin/secretary role
drop policy if exists "staff manage parent links" on public.parent_children;
create policy "staff manage parent links" on public.parent_children for all
  using (school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher','Secretary'))
  with check (school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher','Secretary'));

drop policy if exists "staff manage parents" on public.parents;
create policy "staff manage parents" on public.parents for update
  using (school_id = public.my_school_id() and public.my_role() in ('Principal','Senior Teacher','Secretary'))
  with check (school_id = public.my_school_id());

-- Parent cannot update own status (no policy = blocked). Good.

-- Revoke execute on internal helpers from anon where not needed
revoke all on function public.handle_new_staff_inline(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_parent_inline(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_user_router() from public, anon, authenticated;

grant execute on function public.my_approved_children() to authenticated;
grant execute on function public.my_parent_school_id() to authenticated;
grant execute on function public.school_name_for_code(text) to anon, authenticated;
