create or replace function public.accept_my_advance_offer(
  p_appointment_id uuid,
  p_doctor_id uuid,
  p_scheduled_at timestamptz
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
    raise exception 'A antecipacao nao pode usar data ou horario que ja passou.';
  end if;

  if not exists (
    select 1
    from public.doctors d
    where d.id = p_doctor_id and d.active = true
  ) then
    raise exception 'Medico indisponivel para antecipacao.';
  end if;

  select p.id
    into v_patient_id
  from public.patients p
  where
    p.id = auth.uid()
    or (to_jsonb(p) ? 'user_id' and to_jsonb(p)->>'user_id' = auth.uid()::text)
    or (to_jsonb(p) ? 'auth_user_id' and to_jsonb(p)->>'auth_user_id' = auth.uid()::text)
    or lower(coalesce(p.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
  order by p.id
  limit 1;

  v_patient_id := coalesce(v_patient_id, auth.uid());

  if not exists (
    select 1
    from public.appointments a
    where
      a.id = p_appointment_id
      and a.patient_id = v_patient_id
      and a.status in ('requested', 'confirmed')
      and a.scheduled_at > now()
  ) then
    raise exception 'Consulta original nao encontrada ou nao pertence ao paciente logado.';
  end if;

  if exists (
    select 1
    from public.appointments a
    where
      a.id <> p_appointment_id
      and a.doctor_id = p_doctor_id
      and a.scheduled_at = p_scheduled_at
      and a.status <> 'cancelled'
  ) then
    raise exception 'A vaga escolhida ja foi ocupada.';
  end if;

  update public.appointments
    set
      doctor_id = p_doctor_id,
      scheduled_at = p_scheduled_at,
      status = 'confirmed',
      updated_by = auth.uid(),
      updated_at = now()
    where id = p_appointment_id
    returning * into v_row;

  return v_row;
end $$;

grant execute on function public.accept_my_advance_offer(uuid, uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
