-- ============================================================
-- ShuleKit — Security patch (run AFTER 01–08)
--
-- 07_features_pack.sql accidentally reintroduced the exact
-- privilege-escalation bug that 03_security_fixes.sql had already
-- fixed: its replacement of handle_new_staff_inline() let anyone
-- joining a school via the school code self-select 'Senior Teacher'
-- or 'Deputy Principal' at signup (only 'Principal' was blocked).
-- Both of those roles carry full admin rights throughout the RLS
-- policies (see lib/roles.js ADMIN array), so this amounted to
-- "type in the school code, tick a role, get approved, get admin."
-- Confirmed still live in this build: 08_remaining_features.sql
-- never touches this function, so 07's version is what actually runs.
--
-- Separately, the staff-management UPDATE policy on `users` lets
-- ANY Senior Teacher or Deputy Principal promote any other staff
-- member straight to Principal, with no restriction on target role
-- — also unchanged since 07.
--
-- Third, `my_school_id()` (which nearly every RLS policy in the
-- project is built on) never checks whether the school itself is
-- suspended — only whether the staff account is active. So Super
-- Admin's "Suspend" button only hides the dashboard client-side;
-- the data stays fully readable/writable via direct API calls.
-- `school_plan_ok()` from 08_remaining_features.sql does check
-- is_suspended, but it's defined and granted, never actually called
-- from anywhere in RLS or the frontend — dead code today.
--
-- This migration is idempotent — safe to re-run.
-- ============================================================

-- 1) Restore Teacher/Secretary-only self-selection on join, while
--    keeping the school_level / referral-code additions from 07.
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
    -- SECURITY: only Teacher or Secretary may be self-selected at signup.
    -- Deputy Principal / Senior Teacher / Principal can only be GRANTED
    -- later by an existing Principal, never claimed at join time.
    r := meta->>'role';
    if r not in ('Teacher','Secretary') then r := 'Teacher'; end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Staff'), r, 'pending');
  end if;
end $$;

-- 2) Only a Principal may set someone's role to an admin-tier role
--    (Principal / Deputy Principal / Senior Teacher). Senior Teacher
--    and Deputy Principal can still approve/manage Teacher and
--    Secretary accounts (status changes, demotions), just not mint
--    new admin-tier staff.
drop policy if exists "admins manage staff" on public.users;
create policy "admins manage staff" on public.users for update
  using (
    school_id = public.my_school_id()
    and public.my_role() in ('Principal','Deputy Principal','Senior Teacher')
    and id <> auth.uid()
  )
  with check (
    school_id = public.my_school_id()
    and (
      role not in ('Principal','Deputy Principal','Senior Teacher')
      or public.my_role() = 'Principal'
    )
  );

-- 3) Make "Suspend" in Super Admin an actual kill-switch, not just a
--    UI message. Nearly every RLS policy in this project is built on
--    my_school_id(), so excluding suspended schools here cuts off
--    read/write access everywhere at once — not just what Dashboard.jsx
--    happens to check client-side (which a direct API call bypasses).
create or replace function public.my_school_id() returns uuid
language sql stable security definer set search_path = public as $$
  select u.school_id
  from public.users u
  join public.schools s on s.id = u.school_id
  where u.id = auth.uid() and u.status = 'active' and coalesce(s.is_suspended, false) = false
$$;

-- Note: this patch deliberately does NOT also enforce plan_expires_at
-- (subscription lapse) inside my_school_id() — unlike suspension, that's
-- a business decision (grace period? read-only vs fully locked? warning
-- banner first?) rather than an unambiguous security fix, so it's left
-- for a deliberate follow-up rather than bundled in silently here.

-- 4) Review only — does not change anything. If any row below is
--    someone you did NOT deliberately promote yourself via School
--    Setup > Staff, demote them immediately:
--    update public.users set role = 'Teacher' where id = '<their id>';
select u.id, u.full_name, u.email, u.role, u.status, s.school_name
from public.users u
join public.schools s on s.id = u.school_id
where u.role in ('Deputy Principal','Senior Teacher')
order by u.created_at;
