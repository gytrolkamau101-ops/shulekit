# ShuleMoja — Setup Guide

> Run SQL in order: **01_schema.sql** → **02_parent_portal.sql** → **03_security_fixes.sql** → **04_v7_features.sql**
>
> New in v7: term edit/delete, CBC/custom grading scales, bulk CSV student import, Super Admin + audit log.


This is a working rebuild: real security rules, a working sign-up/approval flow, and forms that actually save data. Follow these steps in order.

---

## 1. Create your Supabase project

1. Go to **supabase.com** → sign up (free) → **New project**, name it `shulekit`.
2. Wait for it to finish setting up (a minute or two).
3. Open **SQL Editor** → **New query**.
4. Open `01_schema.sql` from this package, copy *all* of it, paste into the editor, and click **Run**.
   - This creates every table, turns on security rules (RLS) so each school only ever sees its own data, and sets up a trigger that runs automatically whenever someone signs up.
5. Go to **Settings → API** and copy two values somewhere safe:
   - **Project URL**
   - **anon public** key

---

## 2. Turn off "confirm email" while you're testing (optional but recommended)

Supabase normally requires people to click a confirmation email before logging in. While you're testing on your phone this adds friction. Under **Authentication → Providers → Email**, you can toggle "Confirm email" off for now, and turn it back on before you have real schools using it.

---

## 3. Set up the project on your computer (or ask someone with a laptop to do this part once)

```bash
# unzip ShuleMoja_Starter.zip first, then inside the shulekit_v7 folder:
npm install
cp .env.example .env
```

Open `.env` and paste in your Project URL and anon key from Step 1:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Run it locally:

```bash
npm run dev
```

Open the link it prints (usually `http://localhost:5173`).

---

## 4. How accounts work now

- **First person (you)** registers and picks **"Register a new school (I am the Principal)"**. This instantly creates the school and makes you an active Principal — no waiting.
- Everyone else registers and picks **"Join an existing school"**, entering the **school code** you'll find in **School Setup → Staff** once you're logged in. Their account is created as **pending**.
- As Principal, go to **School Setup → Staff** and tap **Approve** next to their name. Only then can they see any school data. This is the access control you described (Principal/Senior Teacher full access, Secretary and Teacher limited) — enforced by the database itself, not just hidden in the menu.

---

## 5. First things to do after logging in

1. **School Setup → Terms**: add Term 1/2/3 for the year, then tap **Set as current** on the one that's active now. Most pages (fees, exams) won't work until a current term is set.
2. **School Setup → Grades & Subjects**: add your classes (e.g. "Grade 4", "Form 2") and subjects.
3. **School Setup → Fee Structure**: set the total fee per grade for the current term.
4. **Students**: start adding students.
5. **Student Finance**: record fee payments.

---

## 6. Deploy to Netlify

1. Push this folder to a GitHub repo.
2. On **netlify.com** → **Add new site → Import an existing project** → pick the repo.
3. Build command: `npm run build`, publish directory: `dist` (netlify.toml already sets this).
4. Under **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. You'll get a live `https://....netlify.app` link.

---

## What changed from the first draft

- **Security rules are now real.** Every table is locked to the logged-in user's own school and role — not just hidden in the UI.
- **Sign-up works end to end.** New school → instant Principal. Join school → pending until approved. No more manual database setup needed to get a first user in.
- **Forms actually save**, with duplicate-entry and validation error messages shown on screen (e.g. duplicate admission number, duplicate receipt number).
- **School Setup page added** — terms, grades, subjects, fee structure, calendar, and staff approval, all in one place, restricted to Principal/Senior Teacher.
- **Phone-friendly layout** — the sidebar collapses behind a menu button on small screens.
- **Forgot password and reset-password** both work (Supabase sends a real email link).

## Known gaps (next round)

- Exam **marks entry form** isn't wired up yet (you can create an exam, but entering per-student marks needs one more page) — tell me if you want this next.
- No parent portal yet (you mentioned this — it's a separate login experience, worth planning deliberately).
- No attendance page yet — the database table exists but there's no screen for it.
- No automatic fee balance (paid vs total) — the data is there, just not calculated and displayed yet.

Tell me which of these to build next.
