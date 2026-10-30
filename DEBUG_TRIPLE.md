# Triple debug notes (v47.0.1)

## Pass 1 — structure
- Exams.jsx fragment balanced (build-safe)
- SchoolFinance receives user
- StudentFinance print outside fetchAll
- Class subjects sends teacher_id
- Games + StreamsCard present

## Pass 2 — runtime
- PremiumGate now gates `games`
- STK/webhook include pro @ 5000
- Parent fee + exam download helpers present
- Report rank + remarks present

## Pass 3 — safety
- user?.role on Resources, Boarding, Transport, Exams
- Deputy Principal can edit data/finance/resources
- Sidebar unused import removed

## You still must
1. Run 25_v47_subject_games.sql in Supabase
2. Deploy this zip to Netlify (shulemoja only)
3. Test STK on live URL only
