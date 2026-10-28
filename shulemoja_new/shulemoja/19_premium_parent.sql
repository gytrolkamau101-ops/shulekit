-- Parents can read circulars for their school (audience all or parents)
drop policy if exists "parent reads circulars" on public.circulars;
create policy "parent reads circulars" on public.circulars for select
  using (
    audience in ('all', 'parents')
    and school_id in (
      select school_id from public.parents where id = auth.uid() and status = 'active'
    )
  );
