-- v37 streams + student lifecycle status
create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_id uuid references public.grades(id) on delete cascade,
  stream_name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, grade_id, stream_name)
);
create index if not exists idx_streams_school on public.streams(school_id);
alter table public.streams enable row level security;
drop policy if exists "streams school" on public.streams;
create policy "streams school" on public.streams for all
  using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id());

alter table public.students add column if not exists stream_id uuid references public.streams(id) on delete set null;
alter table public.students add column if not exists status text default 'Active';
-- Active | Suspended | Transferred | Inactive
alter table public.admissions add column if not exists grade_id uuid references public.grades(id) on delete set null;
alter table public.admissions add column if not exists stream_id uuid references public.streams(id) on delete set null;

-- When student leaves, freeze parent links
create or replace function public.revoke_parent_on_student_exit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('Transferred', 'Inactive') and (old.status is distinct from new.status) then
    update public.parent_children
      set status = 'revoked'
      where student_id = new.id and status = 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_student_exit_revoke on public.students;
create trigger trg_student_exit_revoke
  after update of status on public.students
  for each row execute function public.revoke_parent_on_student_exit();
