create or replace function public.confirm_my_appointment(
  p_appointment_id uuid
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
      and a.status = 'requested'
      and a.scheduled_at > now()
  ) then
    raise exception 'Consulta nao encontrada, ja confirmada ou nao pertence ao paciente logado.';
  end if;

  update public.appointments
    set
      status = 'confirmed',
      updated_by = auth.uid(),
      updated_at = now()
    where id = p_appointment_id
    returning * into v_row;

  return v_row;
end $$;

grant execute on function public.confirm_my_appointment(uuid) to authenticated;

notify pgrst, 'reload schema';
