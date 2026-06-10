-- Garante que a equipe (secretaria/gestao/admin) veja TODO o histórico de SMS,
-- independentemente de quem enviou, e que o paciente veja apenas os próprios.
alter table if exists public.sms_logs enable row level security;

drop policy if exists "sms_logs staff select" on public.sms_logs;
create policy "sms_logs staff select" on public.sms_logs
  for select
  using (public.current_user_is_support_staff());

drop policy if exists "sms_logs patient select" on public.sms_logs;
create policy "sms_logs patient select" on public.sms_logs
  for select
  using (patient_id in (select public.current_user_patient_ids()));

grant select on public.sms_logs to authenticated;

notify pgrst, 'reload schema';
