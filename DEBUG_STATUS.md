# Debug status (v44.0.1)

## Codebase checks (passed)
- App.jsx does not import missing ToastHost
- Setup.jsx logo form tags balanced; StreamsCard placed correctly
- Resources.jsx imports ordered
- Basic/Premium termly pricing only (2000 / 3500)
- netlify.toml has /api/stk and /api/webhook force redirects
- STK tries /api/stk then /.netlify/functions/intasend-stk

## STK HTTP 404 (runtime — not fixed by app alone)
1. Test only on https://YOUR-SITE.netlify.app (not localhost)
2. Open https://YOUR-SITE.netlify.app/api/stk — must return JSON
3. Netlify env: INTASEND_SECRET_KEY, INTASEND_LIVE, VITE_INTASEND_*
4. git push + wait for green deploy; Netlify → Functions must list intasend-stk

## SQL still required on Supabase (if not run)
- 22_v37_streams_status.sql
- 23_v38_modules.sql
- 24_v41_status_fix.sql
