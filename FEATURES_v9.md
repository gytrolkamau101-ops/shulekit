# ShuleKit v9

Built on your v7 base + full discussed feature set.

## Included
- Multi-tenant RLS, roles (Principal, Deputy Principal, Senior Teacher, Secretary, Teacher)
- Parent portal (term/year selector)
- Super Admin + audit
- Terms, grades, subjects, **subject baskets → class assignment**
- CBC / custom grading scales
- Students, enrollments, CSV import/export
- Fees, arrears, **carry-forward on new current term**
- **Promotion** with Principal deselect
- Exams with **basket-limited subjects**
- **Report cards** rank + **Print/PDF**
- Attendance + offline queue
- Timetable: **tap to edit**, auto-fill, **reshuffle**
- Messages: multi-select **WhatsApp / SMS app** open
- Payment settings (Paybill / instructions)
- IntaSend: **hosted checkout** (publishable key) for platform subs
- PWA / service worker
- School level primary/secondary + CBC grade seeds
- Referrals fields + Super Admin plan extend
- Onboarding checklist on dashboard

## SQL order
01 → 09 (run any missing in Supabase)

## External still
- IntaSend webhooks (secret key on server)
- Official MoE NEMIS API
- Native app stores
