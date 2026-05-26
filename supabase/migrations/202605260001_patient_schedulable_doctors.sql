create or replace function public.list_available_doctors_for_patient(
  p_specialty text default null
)
returns table (
  id uuid,
  full_name text,
  crm text,
  crm_uf text,
  specialty text,
  active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    d.id,
    d.full_name,
    d.crm,
    d.crm_uf,
    d.specialty,
    d.active
  from public.doctors d
  where
    d.active = true
    and (p_specialty is null or p_specialty = '' or d.specialty = p_specialty)
  order by d.full_name asc;
$$;

grant execute on function public.list_available_doctors_for_patient(text) to authenticated;

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

  if not exists (
    select 1
    from public.doctors d
    where d.id = p_doctor_id and d.active = true
  ) then
    raise exception 'Medico indisponivel para agendamento.';
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
