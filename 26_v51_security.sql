-- v51: payment idempotency + longer school codes + audit helpers

-- Unique invoice when present (idempotent webhooks)
create unique index if not exists subscription_events_invoice_unique
  on public.subscription_events (invoice_id)
  where invoice_id is not null and length(trim(invoice_id)) > 0;

create index if not exists subscription_events_api_ref on public.subscription_events (api_ref);

-- Longer school codes for NEW schools (12 hex chars)
create or replace function public.handle_new_staff_inline(uid uuid, uemail text, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid; code text; r text; lvl text; ref text;
begin
  if coalesce(meta->>'school_name','') <> '' then
    loop
      code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
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
    if r not in ('Teacher','Secretary') then r := 'Teacher'; end if;
    insert into public.users (id, school_id, email, full_name, role, status)
      values (uid, sid, uemail, coalesce(nullif(meta->>'full_name',''), 'Staff'), r, 'pending');
  end if;
end $$;

-- Rate-limit helper table (signup / join attempts by IP hash — optional app use)
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  hits int not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;
