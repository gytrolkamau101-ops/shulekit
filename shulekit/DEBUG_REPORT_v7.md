# ShuleKit — Debug report

## Fixes in this build (6.0.1)

1. **Fee balances table** — showed combined total under "Term fee". Now columns: Term fee | Arrears | Paid | Balance.
2. **Timetable teacher names** — removed fragile PostgREST embed `users:teacher_id`; names resolve from staff list.
3. **CBC seed bands** — BE 0–39.99, AE 40–59.99, ME 60–79.99, EE 80–100 (editable in Setup → Grading).
4. **Add student** — if a current term exists, grade is required so enrollment is created (exams/attendance depend on it).
5. **Exam marks** — clamped to 0–100 before save.
6. **06_debug_fixes.sql** — parent read policies re-asserted; opening-balance unique constraint helper.

## Verified OK
- Import paths resolve
- Brace balance on all JSX
- Login join roles limited to Teacher/Secretary
- Term edit/delete, Baskets, Grading, Super Admin present
- Student CSV import/export present
- Resource upload targets bucket `school-resources`

## Ops checklist
1. Run SQL 01→02→03→04→05 (and optional 06)
2. Storage bucket `school-resources`
3. Super Admin insert into platform_admins
4. Seed grading scale after first login
5. Set current term before students/fees/exams

## Known limits (not bugs)
- Offline-first, IntaSend, SMS, full NEMIS API not in v7
- CSV import does not auto-enroll class (assign grade after import)
- Timetable is manual grid, not auto-generator
