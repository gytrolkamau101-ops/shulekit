-- Premium-first pricing text
insert into public.platform_settings (key, value) values
  ('pricing', '{
    "currency": "KES",
    "plans": [
      {"id":"premium","name":"Premium","price":4000,"period":"per term","days":120,"highlight":true,"features":["Messages, Attendance, Timetable, Circulars, Import","Parent tools + bulk WhatsApp","Up to 500 learners"]},
      {"id":"basic","name":"Basic","price":2000,"period":"per term","days":120,"highlight":false,"features":["Students, fees, exams, reports","Admissions & setup","Parent view only","Up to 250 learners"]}
    ]
  }'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
