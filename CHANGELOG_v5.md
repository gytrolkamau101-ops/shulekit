# ShuleMoja

## Shipped
1. **Terms** — edit and delete (blocked if current or FK-linked data)
2. **Grading** — Setup tab: seed CBC (BE/AE/ME/EE) or Classic A–E; custom bands; exams use active scale
3. **Bulk CSV import** — Students → Import CSV (`admission_no,first_name,last_name,gender,parent_*`)
4. **Super Admin** — platform_admins; list schools; suspend; plan; audit log (latest 100)
5. **Audit** — `log_audit` RPC; term create/update/delete/set_current; grade scale seed/activate
6. **School suspend** — staff blocked when `schools.is_suspended`

## SQL
Run `04_v5_features.sql` after 01–03.

## Become Super Admin
```sql
insert into public.platform_admins (id, email, full_name)
values ('YOUR-AUTH-USER-UUID', 'you@email.com', 'Platform Owner');
```
Get UUID from Authentication → Users in Supabase.
