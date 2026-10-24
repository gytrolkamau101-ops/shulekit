# ShuleKit v6

## Bulk SMS / WhatsApp
Messages → multi-select parents → Open WhatsApp or Phone SMS app with pre-filled text. Secretary taps Send.

## IntaSend
- Frontend: `VITE_INTASEND_PUBLIC_KEY` + `VITE_INTASEND_LIVE=true|false`
- **Never** put secret key in .env for Vite
- Super Admin → Pay with IntaSend for school subscription; on COMPLETE extends +90 days

## Offline / PWA
- Service worker caches app shell
- Installable (Add to Home Screen)
- Offline queue for attendance + fees still applies

## What to send us for IntaSend
Only the **publishable** key for the environment you want to test:
- Sandbox: `ISPubKey_test_...`
- Live: `ISPubKey_live_...`
And whether live is true or false.
