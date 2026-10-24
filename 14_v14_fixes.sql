-- v14: ensure public pricing readable + seeded
insert into public.platform_settings (key, value) values
  ('pricing', '{
    "currency": "KES",
    "plans": [
      {"id":"basic","name":"Basic","price":2000,"period":"per term","days":120,"features":["Full school records","Fees, exams, attendance, report cards","Parent view portal","Up to 250 learners"]},
      {"id":"premium","name":"Premium","price":4000,"period":"per term","days":120,"features":["Everything in Basic","Parent fee pay","Bulk WhatsApp / SMS","Templates + absent alerts","Up to 500 learners"]}
    ]
  }'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
