# ShuleMoja v41 — audit fix on v40

## Security
- Webhook: plan prices aligned (basic 2000 / premium 3500 / pro 5000)
- No auto plan upgrade if INTASEND_WEBHOOK_CHALLENGE is missing
- Amount must meet expected plan price

## Bugs fixed
- Resources.jsx import order
- Student status Suspended/Transferred (SQL 24)
- STK plan name resolution (from v40)
- Setup: real Streams manager UI
- Parent Premium: download fee statement (print/PDF)
- Students: Suspend/Transfer + WhatsApp letter + print

## SQL to run
22_v37_streams_status.sql (if needed)
23_v38_modules.sql (if needed)
24_v41_status_fix.sql
