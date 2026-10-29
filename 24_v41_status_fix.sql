-- Allow Suspended / Transferred on students (drop legacy check if present)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public' and t.relname = 'students' and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.students drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.students drop constraint if exists students_status_check;
alter table public.students
  add constraint students_status_check
  check (status in ('Active','Inactive','Alumni','Suspended','Transferred'));

alter table public.schools add column if not exists staff_cap int;
alter table public.schools add column if not exists parent_cap int;
