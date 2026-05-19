alter table public.appointments enable row level security;

drop policy if exists "appointments patient self insert" on public.appointments;

do $$
declare
  patient_match text := 'patient_id = auth.uid()';
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients' and column_name = 'user_id'
  ) then
    patient_match := patient_match || ' or p.user_id = auth.uid()';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients' and column_name = 'auth_user_id'
  ) then
    patient_match := patient_match || ' or p.auth_user_id = auth.uid()';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients' and column_name = 'email'
  ) then
    patient_match := patient_match || ' or lower(p.email) = lower(coalesce(auth.jwt()->>''email'', ''''))';
  end if;

  execute format(
    'create policy "appointments patient self insert" on public.appointments for insert with check (
      status = ''requested''
      and scheduled_at > now()
      and (
        patient_id = auth.uid()
        or exists (select 1 from public.patients p where p.id = appointments.patient_id and (%s))
      )
    )',
    patient_match
  );
end $$;

create or replace function public.create_my_appointment(
  p_doctor_id uuid,
  p_scheduled_at timestamptz,
  p_duration_minutes integer default 30,
  p_notes text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_row public.appointments;
begin
  if auth.uid() is null then
    raise exception 'Usuario autenticado nao identificado.';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'A consulta nao pode ser agendada para data ou horario que ja passou.';
  end if;

  select p.id
    into v_patient_id
  from public.patients p
  where
    (to_jsonb(p) ? 'user_id' and to_jsonb(p)->>'user_id' = auth.uid()::text)
    or (to_jsonb(p) ? 'auth_user_id' and to_jsonb(p)->>'auth_user_id' = auth.uid()::text)
    or lower(coalesce(p.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
  order by p.id
  limit 1;

  v_patient_id := coalesce(v_patient_id, auth.uid());

  insert into public.appointments (
    doctor_id,
    patient_id,
    scheduled_at,
    duration_minutes,
    status,
    notes,
    created_by
  )
  values (
    p_doctor_id,
    v_patient_id,
    p_scheduled_at,
    coalesce(p_duration_minutes, 30),
    'requested',
    p_notes,
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end $$;

grant execute on function public.create_my_appointment(uuid, timestamptz, integer, text) to authenticated;

notify pgrst, 'reload schema';
