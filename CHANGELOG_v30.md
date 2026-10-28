# ShuleMoja v30 — changes from v29 (including v29_fixed)

Base used for the final zip: **ShuleKit_v29_fixed.zip** → **ShuleMoja_v30**.

---

## 1. Brand & identity

| Item | v29 | v30 |
|------|-----|-----|
| Product name | ShuleKit | **ShuleMoja** |
| Tagline | “School tools that just work” | **“Run the school. Keep the history.”** |
| Logo letters | SK | **SM** |
| Icon | Simple “SK” on gradient | **School on a globe inside a phone frame** (`public/icon.svg`) |
| PWA manifest | ShuleKit | ShuleMoja + new theme colour |
| Package | `shulekit` 29.0.0 | `shulemoja` **30.0.0** |
| Company (unchanged) | BigDataKE Technologies | BigDataKE Technologies |

UI strings, login title, Super Admin header, sidebar, parent portal copy, terms/how-it-works defaults, and Netlify webhook body text were updated from ShuleKit → ShuleMoja.

---

## 2. Trial (new)

| Rule | Detail |
|------|--------|
| Length | **30 days** from school registration |
| Default plan | `plan = 'trial'` |
| Fields | `trial_ends_at`, `plan_expires_at` set to +30 days |
| UI | Amber **“Trial active until …”** banner on Dashboard |
| After trial | School should subscribe Basic or Premium for the **current term** |

SQL: trigger/`ensure_school_referral_code` + signup path in `handle_new_staff_inline`.

---

## 3. Referral system (major)

### Registration
| Before (v29) | After (v30) |
|--------------|-------------|
| Referral code **optional** | Referral code **required** for new school |
| No live validation | RPC **`validate_referral_code`** before signup |
| Weak codes (8 hex chars) | **`SM-XXXXXX`** style codes |
| — | Internal system code **`GGGGG`** (direct/admin; **not** shown on site) |

### Earning rules (Premium inviters)
| Rule | Value |
|------|--------|
| Who gets a shareable code / Invite card | Schools on **Premium** (and trial treated as eligible for earning while active) |
| When credit is given | When **invitee pays** a platform plan (webhook) |
| Points per paid invite | **100** |
| Unlock free Premium | At **300** credits |
| What unlock does | Set plan Premium, +120 days expiry, credits −300, `free_premium_grants` +1 |
| Max successful invites (lifetime) | **6** |
| Max free Premiums from referrals | **2** |

### New school columns
- `referral_credits`
- `lifetime_invite_count`
- `free_premium_grants`
- `referred_by_school_id`
- (existing) `referral_code`, `referred_by_code`

### UI
- **Dashboard (Premium):** Invite card — code, Copy, WhatsApp share, progress bar, invites x/6, free Premiums x/2  
- **Super Admin → Referrals:** Ledger table (school, code, credits, invites, free premia, referred by, plan)

### Backend
- `validate_referral_code(p_code)` — anon/authenticated  
- `credit_referrer_on_payment(p_school_id, p_plan_id)` — service role / webhook  
- IntaSend webhook: after successful plan upgrade → calls credit RPC  
- Signup: `handle_new_staff_inline` enforces code + trial + referrer link  

New file: `src/lib/referral.js`  
New SQL: **`20_v30_referral_trial.sql`** (must be run in Supabase)

### Premium plan copy
Premium feature list now includes: *“Invite schools — unlock free Premium terms”*.

---

## 4. Money path (unchanged policy, still enforced)

| Flow | Behaviour |
|------|-----------|
| School fees | **Not** collected via platform STK; parents pay school Till/Paybill; staff record in app |
| Platform subscription | IntaSend STK / webhook for Basic/Premium only |
| You | Not in school-fee money path |

---

## 5. Files added / important paths

| Path | Role |
|------|------|
| `20_v30_referral_trial.sql` | Trial + referral schema/functions |
| `src/lib/referral.js` | Progress helpers + WhatsApp share text |
| `src/brand.js` | ShuleMoja constants |
| `public/icon.svg` | New mark |
| `V30_NOTES.md` | Short deploy notes |
| `netlify/functions/intasend-webhook.js` | + referrer credit after paid plan |

---

## 6. Bugs / gaps still to watch

These are either pre-existing, partially done, or depend on your environment:

### Must-do on your side (not a code bug)
1. **Run `20_v30_referral_trial.sql`** — without it, registration fails on `validate_referral_code` / missing columns.  
2. **Redeploy Netlify** with service role + IntaSend env vars so webhook can credit referrers.  
3. **Email of referral code to Principal** after signup — **not wired** (no email provider in stack). Code is generated and shown on Dashboard after login; auto-email is still missing.  
4. Give early schools a real code or use **GGGGG** only via support (not public).

### Product / logic edge cases
5. **Basic inviters** — codes may still validate for *tracking*, but **credits only for Premium/trial/pro inviters**. Basic schools do not get the Invite card.  
6. **Free Premium at 300 applies immediately** to inviter’s plan (+120 days), not strictly “next term only” in calendar sense — closer to “free Premium period now.”  
7. **Pending payments** — invitee must fully pay (webhook COMPLETE/PAID); abandoned STK does not credit.  
8. **Duplicate credit** — if webhook retries, ensure you don’t double-credit (RPC doesn’t fully idempotent-guard per invoice yet).  
9. **School row refresh** — after credits, Dashboard may need reload/refetch of `school` for live progress (depends how parent loads school).  

### Rename / polish
10. Some **docs/SQL comments** may still say ShuleKit historically; runtime UI is ShuleMoja.  
11. Super Admin theme default logo_text may still be **SK** until you set **SM** in Theme.  
12. **package-lock** may still reference old name until `npm install` regenerates.  

### From earlier versions (not introduced by v30, still relevant)
13. White/invisible inputs if theme CSS regresses (was fixed before; watch Super Admin dark fields).  
14. Blank screen without ErrorBoundary on rare crashes (ErrorBoundary was added in prior versions — keep it).  
15. Slow first load — lazy routes were improved earlier; heavy dashboards can still feel slow on weak networks.  
16. Timetable auto-generate / edit quality depends on prior v29_fixed quality.  
17. Parent “pay fees” is **instructions + school recording**, not platform STK (by design).

---

## 7. Deploy checklist

```text
1. Unzip ShuleMoja_v30.zip → folder shulemoja/
2. Supabase → SQL → run 20_v30_referral_trial.sql
3. Copy .env → npm install → npm run dev (local test)
4. Push / redeploy Netlify
5. Super Admin → Theme → logo_text = SM (optional)
6. Create or note one valid referral code (or GGGGG for your own test only)
```

---

## 8. One-line summary

**v30 = ShuleMoja rebrand + 30-day trial + mandatory hard-to-guess referral codes + Premium invite/rewards ledger + webhook credits; school fees still never go through your IntaSend.**