-- ShuleMoja debug / ops helpers (optional, safe to re-run)

-- Storage: create bucket in Dashboard named school-resources, then run policies:
-- (Storage policies are managed in Dashboard UI in many projects; this is reference SQL)

-- Ensure fee_opening_balances unique for upsert (already in 05; no-op if exists)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fee_opening_balances_school_id_student_id_term_id_key'
  ) then
    alter table public.fee_opening_balances
      add constraint fee_opening_balances_school_id_student_id_term_id_key
      unique (school_id, student_id, term_id);
  end if;
exception when others then null;
end $$;

-- Parent read subjects for exam result joins (if 03 not applied fully)
drop policy if exists "parent reads subjects" on public.subjects;
create policy "parent reads subjects" on public.subjects for select
  using (school_id = public.my_parent_school_id());

drop policy if exists "parent reads exams" on public.exams;
create policy "parent reads exams" on public.exams for select
  using (school_id = public.my_parent_school_id());

drop policy if exists "parent reads own enrollments" on public.student_enrollments;
create policy "parent reads own enrollments" on public.student_enrollments for select
  using (student_id in (select public.my_approved_children()));
