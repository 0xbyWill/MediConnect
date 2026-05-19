alter table public.reports enable row level security;

drop policy if exists "reports patient released read" on public.reports;

do $$
declare
  patient_match text := 'patient_id = auth.uid()';
  profile_match text := '';
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients' and column_name = 'user_id'
  ) then
    profile_match := profile_match || ' or p.user_id = auth.uid()';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients' and column_name = 'auth_user_id'
  ) then
    profile_match := profile_match || ' or p.auth_user_id = auth.uid()';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients' and column_name = 'email'
  ) then
    profile_match := profile_match || ' or lower(p.email) = lower(coalesce(auth.jwt()->>''email'', ''''))';
  end if;

  if profile_match <> '' then
    patient_match := patient_match || format(
      ' or exists (select 1 from public.patients p where p.id = reports.patient_id and (%s))',
      substring(profile_match from 5)
    );
  end if;

  execute format(
    'create policy "reports patient released read" on public.reports for select using (content_json->>''mediconnect_status'' = ''liberado'' and (%s))',
    patient_match
  );
end $$;

create or replace function public.get_my_released_reports()
returns setof public.reports
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.reports r
  where r.content_json->>'mediconnect_status' = 'liberado'
    and (
      r.patient_id = auth.uid()
      or exists (
        select 1
        from public.patients p
        where p.id = r.patient_id
          and (
            (to_jsonb(p) ? 'user_id' and to_jsonb(p)->>'user_id' = auth.uid()::text)
            or (to_jsonb(p) ? 'auth_user_id' and to_jsonb(p)->>'auth_user_id' = auth.uid()::text)
            or lower(coalesce(p.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
          )
      )
    )
  order by r.created_at desc;
$$;

grant execute on function public.get_my_released_reports() to authenticated;
