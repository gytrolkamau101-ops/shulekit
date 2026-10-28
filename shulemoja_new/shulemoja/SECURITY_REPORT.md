# ShuleMoja — Security debug & fixes

## Vulnerabilities found and fixed

### 1. Privilege escalation on staff join (HIGH)
**Issue:** Registration form let anyone pick Principal or Senior Teacher when joining a school. After a rubber-stamp approval they gained admin powers.

**Fix:**
- UI: join roles limited to Teacher / Secretary only.
- DB trigger (`handle_new_staff_inline`): forces role to Teacher unless Teacher or Secretary was requested; ignores Principal / Senior Teacher from client metadata.
- Principal can promote staff via role dropdown in School Setup → Staff.

### 2. Suspended parent still read school data (HIGH)
**Issue:** Policies on `terms` and `fee_structures` only checked `parent_children.status = approved`, not whether the parent account was still `active`. A suspended parent kept read access.

**Fix:** New helper `my_parent_school_id()` requires `parents.status = 'active'`. Those policies now use it. `my_approved_children()` also joins on active parent.

### 3. Parent portal broken / incomplete RLS (MEDIUM → data exposure risk if worked around)
**Issue:** ParentPortal queries `student_enrollments`, `exams`, `subjects` (via joins) with no parent SELECT policies. Either failed closed (broken UX) or tempted insecure workarounds.

**Fix:** Parent SELECT policies scoped to approved children / own school via `my_parent_school_id()` and `my_approved_children()`.

### 4. Admission-number enumeration (MEDIUM)
**Issue:** Distinct errors ("School code not found" vs "No student found with that admission number") let attackers discover valid admission numbers.

**Fix:** Single generic message for parent signup failures.

### 5. Case-sensitive admission match (LOW)
**Issue:** Parent signup could fail if adm no casing differed from school records.

**Fix:** `lower(trim(...))` comparison in parent signup trigger.

### 6. Dashboard ignored RLS roles (LOW / UX)
**Issue:** All staff saw fee/expense quick actions; Teachers hit empty RLS results.

**Fix:** Role-gated stats and quick actions (same as v2 fix).

### 7. Empty date strings on student insert (LOW)
**Issue:** Optional DOB sent as `''` can fail Postgres date columns.

**Fix:** `nullIfEmpty` on optional student fields.

## What was already solid
- RLS enabled on core tables with school_id scoping
- Pending staff/parents blocked via `my_school_id()` requiring `status = 'active'`
- Parent cannot self-approve (no UPDATE policy for parents on own status)
- Signup inserts only via security-definer trigger
- Staff cannot update their own user row (`id <> auth.uid()`)

## Run order on Supabase (existing project)
1. If first install: run `01_schema.sql` then `02_parent_portal.sql`
2. **Always run** `03_security_fixes.sql` after 02 (idempotent drops/recreates)
3. Redeploy / restart frontend from this fixed package

## Residual risks (accept or plan later)
- Anyone with school code + valid admission number can request parent link (mitigated by staff approval)
- School codes are guessable (6 hex chars); rotate/regenerate if leaked
- Anon key is public by design; never put service_role in the app
- No rate limiting on signup (Supabase project settings / CAPTCHA recommended for production)
