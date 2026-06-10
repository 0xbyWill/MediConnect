create extension if not exists pgcrypto;

-- ─── Tabela de mensagens internas paciente ↔ secretaria ──────────────────────
create table if not exists public.patient_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  author text not null check (author in ('paciente', 'secretaria')),
  body text not null check (length(btrim(body)) > 0),
  read boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists patient_messages_patient_idx
  on public.patient_messages(patient_id, created_at);
create index if not exists patient_messages_unread_idx
  on public.patient_messages(patient_id, read);

-- ─── Helpers de identidade ───────────────────────────────────────────────────
create or replace function public.current_user_is_support_staff()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.id = auth.uid() or p.user_id = auth.uid() or p.auth_user_id = auth.uid())
      and lower(coalesce(p.role, '')) in (
        'admin', 'gestor', 'gestao', 'manager', 'secretaria', 'secretary', 'receptionist'
      )
      and coalesce(p.active, true) = true
      and coalesce(p.disabled, false) = false
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and lower(coalesce(ur.role, '')) in (
        'admin', 'gestor', 'gestao', 'manager', 'secretaria', 'secretary', 'receptionist'
      )
  );
$$;

create or replace function public.current_user_patient_ids()
returns setof uuid
language sql
stable
set search_path = public
as $$
  select p.id
  from public.patients p
  where p.id = auth.uid()
    or (to_jsonb(p) ? 'user_id' and to_jsonb(p)->>'user_id' = auth.uid()::text)
    or (to_jsonb(p) ? 'auth_user_id' and to_jsonb(p)->>'auth_user_id' = auth.uid()::text)
    or lower(coalesce(p.email, '')) = lower(coalesce(auth.jwt()->>'email', ''));
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.patient_messages enable row level security;

drop policy if exists "patient_messages select" on public.patient_messages;
create policy "patient_messages select" on public.patient_messages
  for select
  using (
    public.current_user_is_support_staff()
    or patient_id in (select public.current_user_patient_ids())
  );

drop policy if exists "patient_messages staff insert" on public.patient_messages;
create policy "patient_messages staff insert" on public.patient_messages
  for insert
  with check (
    public.current_user_is_support_staff()
    and author = 'secretaria'
  );

drop policy if exists "patient_messages patient insert" on public.patient_messages;
create policy "patient_messages patient insert" on public.patient_messages
  for insert
  with check (
    author = 'paciente'
    and patient_id in (select public.current_user_patient_ids())
  );

drop policy if exists "patient_messages update read" on public.patient_messages;
create policy "patient_messages update read" on public.patient_messages
  for update
  using (
    public.current_user_is_support_staff()
    or patient_id in (select public.current_user_patient_ids())
  )
  with check (
    public.current_user_is_support_staff()
    or patient_id in (select public.current_user_patient_ids())
  );

grant select, insert, update on public.patient_messages to authenticated;
grant execute on function public.current_user_is_support_staff() to authenticated;
grant execute on function public.current_user_patient_ids() to authenticated;

notify pgrst, 'reload schema';
