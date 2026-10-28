-- ============================================================
-- ShuleMoja v30 — trial (30 days), referral credits, mandatory codes
-- Run in Supabase SQL Editor after previous scripts
-- ============================================================

alter table public.schools add column if not exists trial_ends_at timestamptz;
alter table public.schools add column if not exists referral_credits int not null default 0;
alter table public.schools add column if not exists lifetime_invite_count int not null default 0;
alter table public.schools add column if not exists free_premium_grants int not null default 0;
alter table public.schools add column if not exists referred_by_school_id uuid references public.schools(id) on delete set null;

create or replace function public.ensure_school_referral_code() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  if new.referral_code is null or new.referral_code = '' then
    loop
      c := 'SM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from public.schools where referral_code = c);
    end loop;
    new.referral_code := c;
  end if;
  if TG_OP = 'INSERT' then
    if new.plan is null or new.plan = '' or new.plan = 'free' then
      new.plan := 'trial';
    end if;
    if new.trial_ends_at is null then
      new.trial_ends_at := now() + interval '30 days';
    end if;
    if new.plan_expires_at is null and new.plan = 'trial' then
      new.plan_expires_at := new.trial_ends_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_school_referral on public.schools;
create trigger trg_school_referral
  before insert on public.schools
  for each row execute function public.ensure_school_referral_code();

update public.schools
set referral_code = 'SM-' || upper(substr(md5(id::text), 1, 6))
where referral_code is null or referral_code = '';

insert into public.referrals (code, owner_name, owner_email, active, reward_note)
values ('GGGGG', 'BigDataKE Direct', 'admin@bigdatake.local', true, 'Internal direct / no school referrer')
on conflict (code) do nothing;

create or replace function public.validate_referral_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
  s record;
  r record;
begin
  if c = '' then
    return jsonb_build_object('ok', false, 'error', 'Referral code is required');
  end if;
  if c = 'GGGGG' then
    return jsonb_build_object('ok', true, 'source', 'system', 'label', 'Direct');
  end if;
  select id, school_name, plan, lifetime_invite_count, referral_code
    into s from public.schools where upper(referral_code) = c limit 1;
  if found then
    if coalesce(s.lifetime_invite_count, 0) >= 6 then
      return jsonb_build_object('ok', false, 'error', 'This code has reached its invite limit');
    end if;
    return jsonb_build_object(
      'ok', true,
      'source', 'school',
      'school_id', s.id,
      'school_name', s.school_name,
      'plan', s.plan
    );
  end if;
  select * into r from public.referrals where upper(code) = c and active = true limit 1;
  if found then
    return jsonb_build_object('ok', true, 'source', 'agent', 'label', coalesce(r.owner_name, c));
  end if;
  return jsonb_build_object('ok', false, 'error', 'Invalid referral code');
end $$;

grant execute on function public.validate_referral_code(text) to anon, authenticated;

create or replace function public.credit_referrer_on_payment(p_school_id uuid, p_plan_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  invitee public.schools%rowtype;
  inviter public.schools%rowtype;
  add_pts int := 100;
  new_credits int;
  granted boolean := false;
begin
  select * into invitee from public.schools where id = p_school_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'school not found');
  end if;
  if invitee.referred_by_school_id is null and invitee.referred_by_code is not null then
    select id into invitee.referred_by_school_id
      from public.schools where upper(referral_code) = upper(invitee.referred_by_code) limit 1;
    if invitee.referred_by_school_id is not null then
      update public.schools set referred_by_school_id = invitee.referred_by_school_id where id = p_school_id;
    end if;
  end if;
  if invitee.referred_by_school_id is null then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'no_referrer');
  end if;
  select * into inviter from public.schools where id = invitee.referred_by_school_id;
  if not found then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'inviter_missing');
  end if;
  if lower(coalesce(inviter.plan, '')) not in ('premium', 'trial', 'pro', 'yearly') then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'inviter_not_premium');
  end if;
  if coalesce(inviter.lifetime_invite_count, 0) >= 6 then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'invite_cap');
  end if;
  new_credits := coalesce(inviter.referral_credits, 0) + add_pts;
  update public.schools set
    referral_credits = new_credits,
    lifetime_invite_count = coalesce(lifetime_invite_count, 0) + 1
  where id = inviter.id;

  insert into public.referral_signups (referral_code, school_id)
  values (inviter.referral_code, p_school_id)
  on conflict do nothing;

  if new_credits >= 300 and coalesce(inviter.free_premium_grants, 0) < 2 then
    update public.schools set
      referral_credits = new_credits - 300,
      free_premium_grants = coalesce(free_premium_grants, 0) + 1,
      plan = 'premium',
      plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + interval '120 days',
      student_cap = greatest(coalesce(student_cap, 250), 500)
    where id = inviter.id;
    granted := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'credited', true,
    'points', add_pts,
    'free_premium_granted', granted
  );
end $$;

create or replace function public.handle_new_staff_inline(uid uuid, uemail text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; code text; r text; lvl text; ref text; v jsonb; ref_school uuid;
begin
  if coalesce(meta->>'school_name','') <> '' then
    ref := upper(trim(coalesce(meta->>'referral_code','')));
    if ref = '' then
      raise exception 'Referral code is required';
    end if;
    v := public.validate_referral_code(ref);
    if coalesce((v->>'ok')::boolean, false) is not true then
      raise exception '%', coalesce(v->>'error', 'Invalid referral code');
    end if;
    if v->>'source' = 'school' then
      ref_school := (v->>'school_id')::uuid;
    else
      ref_school := null;
    end if;
    loop
      code := upper(substr(md5(random()::text), 1, 6));
      exit when not exists (select 1 from public.schools where school_code = code);
    end loop;
    lvl := meta->>'school_level';
    if lvl not in ('primary','secondary','combined') then lvl := 'primary'; end if;
    insert into public.schools (
      school_name, school_code, school_level, referred_by_code, referred_by_school_id,
      plan, trial_ends_at, plan_expires_at, student_cap
    ) values (
      trim(meta->>'school_name'), code, lvl, ref, ref_school,
      'trial', now() + interval '30 days', now() + interval '30 days', 250
    ) returning id into sid;
    insert into public.referral_signups (referral_code, school_id) values (ref, sid);
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Principal'), 'Principal', 'active');
  else
    select id into sid from public.schools where school_code = upper(trim(coalesce(meta->>'school_code','')));
    if sid is null then
      raise exception 'Invalid school details';
    end if;
    r := meta->>'role';
    if r not in ('Teacher','Secretary','Deputy Principal','Senior Teacher') then r := 'Teacher'; end if;
    if r = 'Principal' then r := 'Teacher'; end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Staff'), r, 'pending');
  end if;
end $$;

drop policy if exists "schools read own referral" on public.referral_signups;
create policy "schools read own referral" on public.referral_signups for select
  using (
    referral_code in (select referral_code from public.schools where id = public.my_school_id())
    or school_id = public.my_school_id()
    or public.is_platform_admin()
  );

insert into public.platform_settings (key, value) values
  ('trial', '{"days": 30, "message": "1 month free to upload data and try ShuleMoja"}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
