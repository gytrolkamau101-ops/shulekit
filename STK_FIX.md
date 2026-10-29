# STK fix (v36.1)

## Common causes of failure
1. Testing on **localhost** — Netlify functions do not run with `npm run dev`. Use the **deployed Netlify URL**, or set `VITE_FUNCTIONS_BASE=https://your-site.netlify.app`.
2. Missing **INTASEND_SECRET_KEY** on Netlify (server env, not VITE_).
3. **Sandbox/live mismatch**: test secret with live=true or vice versa.
4. Invalid phone (must be 07XXXXXXXX / 2547XXXXXXXX).

## Netlify env checklist
- INTASEND_SECRET_KEY = ISSecretKey_test_… or _live_…
- INTASEND_LIVE = false for test, true for live
- VITE_INTASEND_PUBLIC_KEY = matching public key
- VITE_INTASEND_LIVE = same as INTASEND_LIVE
- SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

Redeploy after changing env vars.
