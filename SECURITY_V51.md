# ShuleMoja v51 security notes

## Payment webhook
- Requires `INTASEND_WEBHOOK_CHALLENGE` for plan upgrades (timing-safe compare).
- Optional `INTASEND_WEBHOOK_SECRET`: HMAC-SHA256 of raw body (`x-intasend-signature` or `x-hub-signature-256`).
- Idempotent: unique index on `subscription_events.invoice_id` + pre-check before apply.
- Plan amount must meet expected KES (basic 2000 / premium 3500 / pro 5000).
- Fee webhooks: amount capped; optional auto `fee_payments` row with receipt = invoice id.

## Run in Supabase SQL
```sql
-- file 26_v51_security.sql
```

## Netlify env checklist
- INTASEND_SECRET_KEY
- INTASEND_LIVE=true|false
- INTASEND_WEBHOOK_CHALLENGE=<long random>
- INTASEND_WEBHOOK_SECRET=<optional HMAC secret>
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

## Still recommended (ops / legal)
- ODPC registration + privacy policy page for Kenya DPA 2019
- Supabase PITR / backups on paid plan
- Sentry + Dependabot
- Turnstile/hCaptcha on public signup (next iteration)
