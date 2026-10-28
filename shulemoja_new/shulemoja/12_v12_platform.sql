-- ShuleMoja v12 platform CMS, branding, message templates, pricing

alter table public.schools add column if not exists po_box text;
alter table public.schools add column if not exists physical_address text;
alter table public.schools add column if not exists motto text;
alter table public.schools add column if not exists phone text;
alter table public.schools add column if not exists email text;

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into public.platform_settings (key, value) values
  ('theme', '{"primary":"#1d4ed8","accent":"#06b6d4","bg_style":"gradient","bg_from":"#0f172a","bg_to":"#1e3a8a","logo_text":"SK"}'::jsonb),
  ('terms', '{"title":"Terms & Conditions","body":"By using ShuleMoja you agree to use the platform lawfully and keep school data confidential. Plans renew as selected. BigDataKE Technologies reserves the right to suspend accounts for abuse."}'::jsonb),
  ('how_it_works', '{"title":"How it works","body":"1. Register your school.\n2. Set the current term and grades.\n3. Add staff, students and fees.\n4. Parents join with your school code.\n5. Subscribe to keep the school active."}'::jsonb),
  ('contacts', '{"title":"Contact us","email":"support@bigdatake.example","phone":"+254700000000","whatsapp":"+254700000000","address":"Nairobi, Kenya"}'::jsonb),
  ('pricing', '{"currency":"KES","plans":[{"id":"trial","name":"Trial","price":0,"period":"first term","days":90,"features":["Full access","Up to 200 students"]},{"id":"termly","name":"Termly","price":5000,"period":"per term","days":120,"features":["Unlimited staff","Priority support","Report cards"]},{"id":"yearly","name":"Yearly","price":15000,"period":"per year","days":365,"features":["Best value","All termly features","Referral rewards"]}]}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  template_key text not null,
  title text not null,
  body text not null,
  updated_at timestamptz default now(),
  unique (school_id, template_key)
);

alter table public.platform_settings enable row level security;
alter table public.message_templates enable row level security;

drop policy if exists "ps read all" on public.platform_settings;
create policy "ps read all" on public.platform_settings for select using (true);

drop policy if exists "ps admin write" on public.platform_settings;
create policy "ps admin write" on public.platform_settings for all
  using (exists (select 1 from public.platform_admins where id = auth.uid()))
  with check (exists (select 1 from public.platform_admins where id = auth.uid()));

drop policy if exists "mt school" on public.message_templates;
create policy "mt school" on public.message_templates for all
  using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id());

-- seed default templates optional via app
