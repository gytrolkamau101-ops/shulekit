# STK failing — checklist

## 1. Test on live Netlify URL only
Localhost (`npm run dev`) cannot run Netlify functions unless VITE_FUNCTIONS_BASE is set.

## 2. Open this in the browser (on your phone)
https://YOUR-SITE.netlify.app/.netlify/functions/intasend-stk

You should see JSON like:
{"ok":true,"secret_configured":true,"secret_mode":"test","live_flag":false,...}

If you see the login page HTML → function not deployed.
If secret_configured is false → set INTASEND_SECRET_KEY on Netlify and redeploy.

## 3. Netlify env (Site settings → Environment variables)
INTASEND_SECRET_KEY = ISSecretKey_test_... or ISSecretKey_live_...
INTASEND_LIVE = false for test, true for live (must match key)
VITE_INTASEND_PUBLIC_KEY = matching public key
VITE_INTASEND_LIVE = same as INTASEND_LIVE
SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

Then: Deploys → Trigger deploy → Clear cache and deploy.

## 4. Plan ids
Super Admin → Pricing: each plan **id** must be basic, premium, or pro
(Name can be "Termly Premium".)

## 5. Phone
Full number: 07XXXXXXXX (10 digits) or 2547XXXXXXXX
