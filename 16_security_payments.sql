-- School payment rails + payment intent logging
alter table public.schools add column if not exists mpesa_paybill text;
alter table public.schools add column if not exists mpesa_till text;
alter table public.schools add column if not exists mpesa_phone text;
alter table public.schools add column if not exists mpesa_account_ref text;
alter table public.schools add column if not exists fee_payment_instructions text;
-- Do NOT store IntaSend secret keys in the database.

-- Optional: prevent anon from updating payment fields on other schools (RLS should already scope)
