create extension if not exists pgcrypto;
create extension if not exists vector;

do $$ begin
  create type ai_conversation_type as enum ('support', 'description', 'user_message', 'admin_chat');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_conversation_status as enum ('open', 'closed', 'pending_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_message_sender as enum ('user', 'admin', 'ai', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_output_type as enum ('description', 'user_message', 'support_answer', 'admin_answer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_instruction_scope as enum ('general', 'support', 'description', 'user_message', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_training_type as enum ('knowledge', 'faq', 'instruction', 'correction');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_training_status as enum ('active', 'inactive', 'pending_review');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.id = auth.uid() or p.user_id = auth.uid() or p.auth_user_id = auth.uid())
      and lower(coalesce(p.role, '')) in ('admin', 'gestor', 'gestao', 'manager')
      and coalesce(p.active, true) = true
      and coalesce(p.disabled, false) = false
  );
$$;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type ai_conversation_type not null,
  status ai_conversation_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  sender ai_message_sender not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'geral',
  embedding vector(1536),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_generated_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type ai_output_type not null,
  input_data jsonb not null default '{}'::jsonb,
  output_text text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  admin_id uuid,
  action_type text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.ai_messages(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_admin_conversations (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  status ai_conversation_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_admin_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_admin_conversations(id) on delete cascade,
  sender ai_message_sender not null check (sender in ('admin', 'ai', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_instructions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  scope ai_instruction_scope not null default 'general',
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_instruction_versions (
  id uuid primary key default gen_random_uuid(),
  instruction_id uuid not null references public.ai_instructions(id) on delete cascade,
  content text not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null default 'geral',
  embedding vector(1536),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_corrections (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.ai_messages(id) on delete cascade,
  original_answer text not null,
  correct_answer text not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_training_entries (
  id uuid primary key default gen_random_uuid(),
  type ai_training_type not null,
  reference_id uuid not null,
  status ai_training_status not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx on public.ai_messages(conversation_id, created_at);
create index if not exists ai_knowledge_search_idx on public.ai_knowledge_documents using gin (to_tsvector('portuguese', title || ' ' || content || ' ' || category));
create index if not exists ai_faq_search_idx on public.ai_faqs using gin (to_tsvector('portuguese', question || ' ' || answer || ' ' || category));
create index if not exists ai_knowledge_embedding_idx on public.ai_knowledge_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists ai_faq_embedding_idx on public.ai_faqs using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists ai_corrections_message_idx on public.ai_corrections(message_id);
create index if not exists ai_logs_created_idx on public.ai_action_logs(created_at desc);

create or replace function public.match_ai_knowledge_documents(
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (
  id uuid,
  title text,
  content text,
  category text,
  active boolean,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  similarity double precision
)
language sql
stable
as $$
  select
    d.id,
    d.title,
    d.content,
    d.category,
    d.active,
    d.created_by,
    d.updated_by,
    d.created_at,
    d.updated_at,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.ai_knowledge_documents d
  where d.active = true
    and d.embedding is not null
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_ai_faqs(
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (
  id uuid,
  question text,
  answer text,
  category text,
  active boolean,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  similarity double precision
)
language sql
stable
as $$
  select
    f.id,
    f.question,
    f.answer,
    f.category,
    f.active,
    f.created_by,
    f.updated_by,
    f.created_at,
    f.updated_at,
    1 - (f.embedding <=> query_embedding) as similarity
  from public.ai_faqs f
  where f.active = true
    and f.embedding is not null
  order by f.embedding <=> query_embedding
  limit match_count;
$$;

drop trigger if exists set_ai_conversations_updated_at on public.ai_conversations;
create trigger set_ai_conversations_updated_at before update on public.ai_conversations for each row execute function public.set_updated_at();
drop trigger if exists set_ai_knowledge_updated_at on public.ai_knowledge_documents;
create trigger set_ai_knowledge_updated_at before update on public.ai_knowledge_documents for each row execute function public.set_updated_at();
drop trigger if exists set_ai_generated_outputs_updated_at on public.ai_generated_outputs;
create trigger set_ai_generated_outputs_updated_at before update on public.ai_generated_outputs for each row execute function public.set_updated_at();
drop trigger if exists set_ai_admin_conversations_updated_at on public.ai_admin_conversations;
create trigger set_ai_admin_conversations_updated_at before update on public.ai_admin_conversations for each row execute function public.set_updated_at();
drop trigger if exists set_ai_instructions_updated_at on public.ai_instructions;
create trigger set_ai_instructions_updated_at before update on public.ai_instructions for each row execute function public.set_updated_at();
drop trigger if exists set_ai_faqs_updated_at on public.ai_faqs;
create trigger set_ai_faqs_updated_at before update on public.ai_faqs for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_knowledge_documents enable row level security;
alter table public.ai_generated_outputs enable row level security;
alter table public.ai_action_logs enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_admin_conversations enable row level security;
alter table public.ai_admin_messages enable row level security;
alter table public.ai_instructions enable row level security;
alter table public.ai_instruction_versions enable row level security;
alter table public.ai_faqs enable row level security;
alter table public.ai_corrections enable row level security;
alter table public.ai_training_entries enable row level security;

drop policy if exists "ai admin full conversations" on public.ai_conversations;
create policy "ai admin full conversations" on public.ai_conversations for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai own conversations read" on public.ai_conversations;
create policy "ai own conversations read" on public.ai_conversations for select using (user_id = auth.uid());

drop policy if exists "ai admin full messages" on public.ai_messages;
create policy "ai admin full messages" on public.ai_messages for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai own messages read" on public.ai_messages;
create policy "ai own messages read" on public.ai_messages for select using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

drop policy if exists "ai active knowledge read" on public.ai_knowledge_documents;
create policy "ai active knowledge read" on public.ai_knowledge_documents for select using (active = true or public.current_user_is_admin());
drop policy if exists "ai admin write knowledge" on public.ai_knowledge_documents;
create policy "ai admin write knowledge" on public.ai_knowledge_documents for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "ai admin full generated outputs" on public.ai_generated_outputs;
create policy "ai admin full generated outputs" on public.ai_generated_outputs for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai own generated outputs read" on public.ai_generated_outputs;
create policy "ai own generated outputs read" on public.ai_generated_outputs for select using (user_id = auth.uid());

drop policy if exists "ai admin logs only" on public.ai_action_logs;
create policy "ai admin logs only" on public.ai_action_logs for select using (public.current_user_is_admin());

drop policy if exists "ai feedback own message" on public.ai_feedback;
create policy "ai feedback own message" on public.ai_feedback for insert with check (
  exists (
    select 1 from public.ai_messages m
    join public.ai_conversations c on c.id = m.conversation_id
    where m.id = message_id and c.user_id = auth.uid()
  )
);

drop policy if exists "ai admin full admin conversations" on public.ai_admin_conversations;
create policy "ai admin full admin conversations" on public.ai_admin_conversations for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai admin full admin messages" on public.ai_admin_messages;
create policy "ai admin full admin messages" on public.ai_admin_messages for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai admin full instructions" on public.ai_instructions;
create policy "ai admin full instructions" on public.ai_instructions for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai admin full instruction versions" on public.ai_instruction_versions;
create policy "ai admin full instruction versions" on public.ai_instruction_versions for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai admin full faqs" on public.ai_faqs;
create policy "ai admin full faqs" on public.ai_faqs for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai active faqs read" on public.ai_faqs;
create policy "ai active faqs read" on public.ai_faqs for select using (active = true or public.current_user_is_admin());
drop policy if exists "ai admin full corrections" on public.ai_corrections;
create policy "ai admin full corrections" on public.ai_corrections for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "ai admin full training entries" on public.ai_training_entries;
create policy "ai admin full training entries" on public.ai_training_entries for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
