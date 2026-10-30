# ShuleMoja v52 — ops checklist

## CAPTCHA (Cloudflare Turnstile — free)
1. Create a Turnstile site at https://dash.cloudflare.com → Turnstile
2. Netlify env: `VITE_TURNSTILE_SITE_KEY=<site key>`
3. Redeploy. Register form shows the widget.

## Sentry (optional)
Netlify env: `VITE_SENTRY_DSN=https://...@sentry.io/...`
Loads browser SDK from CDN when set.

## Privacy / Kenya DPA
- Default privacy policy ships in-app (ODPC-oriented).
- Super Admin → Pages → **Privacy Policy (Kenya DPA)** to edit.
- Login → Register → Privacy Policy link.
- Register your organisation with ODPC when required: https://www.odpc.go.ke

## CI / Dependabot
- `.github/workflows/ci.yml` — install, audit, build on push
- `.github/dependabot.yml` — weekly npm updates
Push repo to GitHub with Actions enabled.

## SMS fallback
`support.js`: WhatsApp → SMS → tel for parent notify helpers.
