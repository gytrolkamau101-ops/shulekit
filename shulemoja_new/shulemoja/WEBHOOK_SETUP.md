# IntaSend webhook — what to send Grok / how to fill the form

## 1. Generate a Challenge string
Make a long random secret, e.g. in Termux:
```
openssl rand -hex 24
```
Copy the result. Paste it into IntaSend **Challenge** field.

## 2. Endpoint URL
After you deploy ShuleMoja to **Netlify**:
```
https://YOUR-SITE-NAME.netlify.app/.netlify/functions/intasend-webhook
```
Example: `https://shulekit.netlify.app/.netlify/functions/intasend-webhook`

Until Netlify is live, leave webhook unset and extend plans manually in Super Admin.

## 3. Event checkboxes
Tick at least:
- **Collection event** (payments completed)
- **Subscription event** (if you use IntaSend subscriptions)

## 4. Netlify environment variables
Site settings → Environment variables:

| Name | Value |
|------|--------|
| `INTASEND_WEBHOOK_CHALLENGE` | Same as Challenge in IntaSend |
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (secret!) |
| `INTASEND_SECRET_KEY` | IntaSend dashboard → API Keys → **Secret key** (sandbox or live, matching `VITE_INTASEND_LIVE`) |

Never put `service_role` or `INTASEND_SECRET_KEY` in the phone `.env` or Vite — Netlify environment variables only.

**Without `INTASEND_SECRET_KEY` set, the "pay with M-Pesa number" shortcut silently falls back to
IntaSend's hosted checkout page** (the one that makes people choose a payment method first) — the
app won't show an error, it will just behave like before. If payments still show the hosted page
after a school enters its phone number, this is the first thing to check.

## 5. What to paste back in chat (safe list)
- Netlify site URL (public)
- Confirm Challenge is set (do **not** paste the secret in public chat if possible)
- Confirm service_role is only on Netlify

## 6. SQL
Run `13_v13_plans.sql` in Supabase.
