# ShuleMoja

## New
- **Subject baskets** — Setup → Baskets; group subjects; assign to grade + term
- **Timetable** — grid Mon–Sat, periods 1–8; subject + teacher + room
- **Report cards** — class ranking by exam with per-subject marks and average
- **Resource file upload** — Supabase Storage bucket `school-resources`
- **Fee arrears** — opening balance per student/term; balance = term fee + arrears − paid
- **Student export** — NEMIS-style CSV export (plus existing import)

## SQL
Run **05_v7_features.sql** after 01–04.

## Storage setup
Supabase → Storage → New bucket → name: `school-resources`
Policies: allow authenticated upload/read for your school paths (or public read for simple pilots).

## Still later
- Offline-first sync
- IntaSend ShuleMoja subscriptions
- Per-school parent fee STK
- SMS/WhatsApp
- Full NEMIS API sync
