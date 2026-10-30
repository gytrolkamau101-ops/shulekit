# ShuleMoja v50.0.0 — Debug pass

Static review of the full codebase (src/App.jsx, all components/pages/*.jsx,
src/lib/*.js, src/pages/*.jsx, netlify/functions/*, and the 01–25 SQL
migrations) plus the project's prior DEBUG_*/STK_*/SECURITY_* notes. Since
`npm install` cannot reach the registry in this environment, verification was
done by careful manual reading, table/column cross-checks against the SQL
schema, and pattern-based greps (duplicate keys, missing query columns, hook
dependency issues, etc.) rather than a real build.

## Bugs fixed

1. **Attendance.jsx — "Notify absent (WhatsApp)" never found any absentee**
   - File: `src/components/pages/Attendance.jsx`
   - Symptom: Staff click "Notify absent (WhatsApp)" after marking a class;
     the app always says "No absentees with parent phone numbers," even when
     absent students clearly have a parent phone on file in Students.
   - Root cause: `loadClass()`'s Supabase query only selected
     `students(id, admission_no, first_name, last_name)` for the enrolled
     class list — `parent_phone` was never fetched, so every student object
     in `students` state had `parent_phone === undefined`, and the
     `s.parent_phone` filter in `notifyAbsentParents()` always excluded them.
   - Fix: added `parent_phone` to the `student_enrollments` select so the
     WhatsApp absentee-notification feature works as designed.

2. **StudentFinance.jsx — Defaulters list showed blank names and an undefined React key**
   - File: `src/components/pages/StudentFinance.jsx`
   - Symptom: The "Defaulters (balance > 0)" card listed every owing
     student with an empty name, and React would warn about duplicate/missing
     keys (every `<li>` shared `key={undefined}`).
   - Root cause: `balances` is built by spreading each `students` row
     (`{ id, admission_no, first_name, last_name, ... }`); it has no `name`
     or `student_id` field. The Defaulters list rendered `b.name` and used
     `b.student_id` as the React key — neither exists on that object.
   - Fix: render `{b.first_name} {b.last_name}` and key by `b.id` (the
     student's actual id on the balance row).

3. **StudentFinance.jsx — "Print" fee statement showed a blank student name**
   - File: `src/components/pages/StudentFinance.jsx`
   - Symptom: Clicking "Print" next to a balance row opened a fee statement
     with the student's name missing (only admission number showed).
   - Root cause: Same mismatch as above — the lookup
     `students.find((x) => x.id === b.student_id)` always failed because
     `b.student_id` doesn't exist on a balance row (only `b.id` does), so it
     fell back to a synthetic student object built from the equally
     nonexistent `b.name`.
   - Fix: look up by `b.id` and, in the fallback object, use
     `b.first_name`/`b.last_name` (which do exist on the balance row)
     instead of parsing a nonexistent `b.name`.

4. **Exams.jsx — duplicate/racing `useEffect` for class subjects**
   - File: `src/components/pages/Exams.jsx`
   - Symptom: Selecting a grade fired two near-identical Supabase queries
     for the same "subjects assigned to this class via basket" data on every
     change, doubling network calls and creating a race where the simpler
     (basket-only) effect could overwrite the result of the more complete
     effect that also falls back to `subject_allocations` when no basket is
     assigned — occasionally leaving the subject dropdown empty for classes
     that only use direct subject allocation.
   - Root cause: Leftover code from an earlier iteration — a second,
     more complete `useEffect` (with the `subject_allocations` fallback) was
     added without removing the original one; both run on the identical
     `[selectedGrade, term, school.id]` dependency array.
   - Fix: removed the redundant, incomplete `useEffect`, keeping only the
     version that also falls back to `subject_allocations`.

## Areas reviewed with no bugs found
- `src/App.jsx`, `src/supabaseClient.js`, `src/main.jsx` — clean.
- `netlify/functions/intasend-stk.js`, `netlify/functions/intasend-webhook.js`,
  `netlify.toml` — STK/webhook plan resolution, amount validation, and the
  `/api/stk` + `/api/webhook` redirects line up correctly; the pre-registration
  "pay before you have a school" flow intentionally has no `school_id` at
  payment time and is reconciled manually from Super Admin → Payments (as
  documented in DEBUG_STATUS.md / SECURITY_REPORT.md) — not a bug.
- `src/components/pages/Games.jsx`, `Timetable.jsx`, `Boarding.jsx`,
  `SchoolFinance.jsx`, `ReportCards.jsx`, `Messaging.jsx` — logic and
  Supabase table/column usage checked against the SQL schema (01–25); all
  consistent.
- `src/lib/roles.js`, `src/lib/plans.js` — role/plan gating tables are
  internally consistent.
- Cross-checked every `.from('table')` call in `src/` against every
  `create table` in the SQL migrations — no missing/typo'd tables.
- No conditionally-called React hooks found; no obvious unhandled promise
  rejections beyond pre-existing, deliberate `catch (_) {}` no-ops used for
  best-effort audit logging.
- No hardcoded secrets/API keys or stray `console.log` debug spam found in
  `src/`.

## Not fixed (by design, not a bug)
- Platform-plan STK payments made from the Login/"subscribe" screen (before
  a school exists) never carry a `school_id`, so the webhook cannot
  auto-upgrade the school's plan; Super Admin reconciles these manually from
  the Payments tab. This matches the documented v41 security behavior ("No
  auto plan upgrade if INTASEND_WEBHOOK_CHALLENGE is missing") and the
  `admin_bill` flow (billing an existing, already-known school) upgrades
  automatically as expected.

## Version
`package.json` bumped from `49.0.2` → `50.0.0`.
