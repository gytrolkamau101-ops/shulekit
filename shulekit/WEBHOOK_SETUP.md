# IntaSend webhook — what to send Grok / how to fill the form

## 1. Generate a Challenge string
Make a long random secret, e.g. in Termux:
```
openssl rand -hex 24
```
Copy the result. Paste it into IntaSend **Challenge** field.

## 2. Endpoint URL
After you deploy ShuleKit to **Netlify**:
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

Never put `service_role` in the phone `.env` or Vite.

## 5. What to paste back in chat (safe list)
- Netlify site URL (public)
- Confirm Challenge is set (do **not** paste the secret in public chat if possible)
- Confirm service_role is only on Netlify

## 6. SQL
Run `13_v13_plans.sql` in Supabase.
