create extension if not exists pgcrypto;

create table if not exists public.appointment_sms_notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null,
  doctor_id uuid,
  notification_type text not null check (notification_type in ('created', 'reminder_7d', 'reminder_1d')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  provider_response jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, notification_type, scheduled_for)
);

create index if not exists appointment_sms_notifications_due_idx
  on public.appointment_sms_notifications(status, scheduled_for);
create index if not exists appointment_sms_notifications_appointment_idx
  on public.appointment_sms_notifications(appointment_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_appointment_sms_notifications_updated_at on public.appointment_sms_notifications;
create trigger set_appointment_sms_notifications_updated_at
before update on public.appointment_sms_notifications
for each row execute function public.set_updated_at();

alter table if exists public.sms_logs
  add column if not exists appointment_id uuid,
  add column if not exists notification_type text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists provider_response jsonb;

create index if not exists sms_logs_appointment_idx on public.sms_logs(appointment_id);
create index if not exists sms_logs_notification_type_idx on public.sms_logs(notification_type);

create or replace function public.enqueue_appointment_sms_notifications(
  p_appointment_id uuid,
  p_include_created boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_now timestamptz := now();
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id;

  if not found then
    return;
  end if;

  if v_appointment.status in ('cancelled', 'completed') then
    update public.appointment_sms_notifications
      set status = 'cancelled',
          error_message = 'Consulta cancelada/finalizada.',
          updated_at = now()
    where appointment_id = p_appointment_id
      and status in ('pending', 'processing', 'failed');
    return;
  end if;

  update public.appointment_sms_notifications
    set status = 'cancelled',
        error_message = 'Lembrete substituido por reagendamento.',
        updated_at = now()
  where appointment_id = p_appointment_id
    and notification_type in ('reminder_7d', 'reminder_1d')
    and status in ('pending', 'processing', 'failed');

  insert into public.appointment_sms_notifications (
    appointment_id, patient_id, doctor_id, notification_type, scheduled_for
  )
  values (
    v_appointment.id,
    v_appointment.patient_id,
    v_appointment.doctor_id,
    'reminder_7d',
    date_trunc('minute', v_appointment.scheduled_at - interval '7 days')
  )
  on conflict (appointment_id, notification_type, scheduled_for) do update
    set status = 'pending',
        error_message = null,
        updated_at = now();

  insert into public.appointment_sms_notifications (
    appointment_id, patient_id, doctor_id, notification_type, scheduled_for
  )
  values (
    v_appointment.id,
    v_appointment.patient_id,
    v_appointment.doctor_id,
    'reminder_1d',
    date_trunc('minute', v_appointment.scheduled_at - interval '1 day')
  )
  on conflict (appointment_id, notification_type, scheduled_for) do update
    set status = 'pending',
        error_message = null,
        updated_at = now();

  if p_include_created then
    insert into public.appointment_sms_notifications (
      appointment_id, patient_id, doctor_id, notification_type, scheduled_for
    )
    values (
      v_appointment.id,
      v_appointment.patient_id,
      v_appointment.doctor_id,
      'created',
      v_now
    )
    on conflict (appointment_id, notification_type, scheduled_for) do nothing;
  end if;
end;
$$;

create or replace function public.handle_appointment_sms_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_appointment_sms_notifications(new.id, true);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status in ('cancelled', 'completed') then
      perform public.enqueue_appointment_sms_notifications(new.id, false);
      return new;
    end if;

    if new.scheduled_at is distinct from old.scheduled_at
      or new.patient_id is distinct from old.patient_id
      or new.doctor_id is distinct from old.doctor_id
      or new.status is distinct from old.status then
      perform public.enqueue_appointment_sms_notifications(new.id, false);
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_appointments_sms_notifications on public.appointments;
create trigger trg_appointments_sms_notifications
after insert or update on public.appointments
for each row execute function public.handle_appointment_sms_notifications();

create or replace function public.claim_due_appointment_sms_notifications(
  p_limit integer default 100
)
returns table (
  id uuid,
  appointment_id uuid,
  patient_id uuid,
  doctor_id uuid,
  notification_type text,
  scheduled_for timestamptz,
  attempt_count integer,
  max_attempts integer,
  patient_full_name text,
  patient_phone text,
  patient_active boolean,
  doctor_full_name text,
  doctor_specialty text,
  appointment_status text,
  appointment_scheduled_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select n.id
    from public.appointment_sms_notifications n
    where
      (
        n.status = 'pending'
        or (
          n.status = 'failed'
          and n.attempt_count < n.max_attempts
          and now() >= coalesce(
            n.last_attempt_at + make_interval(mins => least(60, greatest(1, (power(2, n.attempt_count))::int))),
            n.created_at
          )
        )
      )
      and n.scheduled_for <= now()
    order by n.scheduled_for asc
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
    for update skip locked
  ),
  claimed as (
    update public.appointment_sms_notifications n
      set status = 'processing',
          attempt_count = n.attempt_count + 1,
          last_attempt_at = now(),
          updated_at = now(),
          error_message = null
    where n.id in (select id from candidates)
    returning n.*
  )
  select
    c.id,
    c.appointment_id,
    c.patient_id,
    c.doctor_id,
    c.notification_type,
    c.scheduled_for,
    c.attempt_count,
    c.max_attempts,
    p.full_name as patient_full_name,
    p.phone_mobile as patient_phone,
    coalesce(
      case
        when to_jsonb(p) ? 'active' then (to_jsonb(p)->>'active')::boolean
        else true
      end,
      true
    ) as patient_active,
    d.full_name as doctor_full_name,
    d.specialty as doctor_specialty,
    a.status as appointment_status,
    a.scheduled_at as appointment_scheduled_at
  from claimed c
  join public.appointments a on a.id = c.appointment_id
  left join public.patients p on p.id = c.patient_id
  left join public.doctors d on d.id = c.doctor_id;
$$;

revoke all on function public.claim_due_appointment_sms_notifications(integer) from public;
grant execute on function public.claim_due_appointment_sms_notifications(integer) to service_role;

notify pgrst, 'reload schema';
