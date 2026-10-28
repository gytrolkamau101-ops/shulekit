-- ShuleMoja v13 — plans, entitlements, subscription events

alter table public.schools add column if not exists student_cap int default 250;
alter table public.schools add column if not exists plan_features jsonb default '{}'::jsonb;

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  api_ref text,
  invoice_id text,
  state text,
  amount numeric,
  plan_id text,
  raw jsonb,
  created_at timestamptz default now()
);

create index if not exists sub_events_ref on public.subscription_events(api_ref);

alter table public.subscription_events enable row level security;
drop policy if exists "sub events admin" on public.subscription_events;
create policy "sub events admin" on public.subscription_events for all
  using (exists (select 1 from public.platform_admins where id = auth.uid()));

-- Public pricing: Basic 2000 / Premium 4000
insert into public.platform_settings (key, value) values
  ('pricing', '{
    "currency": "KES",
    "plans": [
      {
        "id": "basic",
        "name": "Basic",
        "price": 2000,
        "period": "per term",
        "days": 120,
        "cap": 250,
        "features": [
          "Full school records",
          "Fees, exams, attendance, report cards",
          "Parent view-only portal",
          "Up to 250 learners (contact us to raise)"
        ]
      },
      {
        "id": "premium",
        "name": "Premium",
        "price": 4000,
        "period": "per term",
        "days": 120,
        "cap": 500,
        "features": [
          "Everything in Basic",
          "Parent fee pay (IntaSend)",
          "Bulk WhatsApp / SMS to parents",
          "Message templates + absent alerts",
          "Defaulter blast + priority support",
          "Up to 500 learners"
        ]
      }
    ]
  }'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
