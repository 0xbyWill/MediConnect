# IA no MediConnect

Este MVP adiciona uma camada de IA segura e controlada sobre Supabase Edge Functions. O frontend nunca recebe `AI_API_KEY`; chamadas ao modelo passam pelas functions versionadas em `supabase/functions`.

## Stack Identificada

- Frontend: React 19, TypeScript e Vite.
- Backend deste repo: Supabase REST e Edge Functions, sem servidor Node local.
- Banco: PostgreSQL do Supabase.
- ORM/query builder: nao ha ORM no frontend; as functions usam `@supabase/supabase-js`.
- Autenticacao: Supabase Auth com JWT salvo no cliente.
- Permissoes: roles normalizadas em `AuthContext`; gestao/admin tem acesso administrativo. A migration inclui RLS e `current_user_is_admin()`.
- Navegacao: estado em `src/App.tsx`, sem React Router.

## Configuracao

Variaveis das Edge Functions:

```env
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_PROVIDER=openai
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=700
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Nunca coloque `AI_API_KEY` no frontend. Configure secrets no Supabase:

```bash
supabase secrets set AI_API_KEY=... AI_MODEL=gpt-4o-mini AI_EMBEDDING_MODEL=text-embedding-3-small AI_PROVIDER=openai AI_TEMPERATURE=0.2 AI_MAX_TOKENS=700
```

## Banco

Aplicar a migration:

```bash
npx supabase login
npx supabase link --project-ref yuanqfswhberkoevtmfr
supabase db push
```

Migration criada:

- `supabase/migrations/202605060001_ai_mvp.sql`

Tabelas criadas:

- `ai_conversations`
- `ai_messages`
- `ai_knowledge_documents`
- `ai_generated_outputs`
- `ai_action_logs`
- `ai_feedback`
- `ai_admin_conversations`
- `ai_admin_messages`
- `ai_instructions`
- `ai_instruction_versions`
- `ai_faqs`
- `ai_corrections`
- `ai_training_entries`

O schema habilita `pgvector`, adiciona coluna `embedding vector(1536)` em documentos e FAQs, e cria as RPCs `match_ai_knowledge_documents` e `match_ai_faqs` para busca semantica.

## Deploy Das Functions

```bash
npx supabase functions deploy ai
npx supabase functions deploy admin-ai
```

## Endpoints De Usuario

Todos usam JWT do usuario autenticado.

### Gerar descricao

```http
POST /functions/v1/ai/generate-description
```

```json
{
  "title": "Consulta inicial",
  "category": "Atendimento",
  "details": "Avaliacao clinica geral",
  "tone": "professional"
}
```

Retorna:

```json
{
  "description": "texto",
  "approved": false
}
```

### Gerar mensagem previa

```http
POST /functions/v1/ai/generate-user-message
```

```json
{
  "userId": "uuid",
  "messageType": "welcome",
  "context": "Paciente criou conta"
}
```

Retorna rascunho com `approved: false`; nada e enviado automaticamente.

### Suporte

```http
POST /functions/v1/ai/support
```

```json
{
  "userId": "uuid",
  "question": "Como vejo meus laudos?"
}
```

Retorna:

```json
{
  "answer": "texto",
  "sourceType": "faq",
  "needsHumanSupport": false
}
```

### Feedback

```http
POST /functions/v1/ai/feedback
```

```json
{
  "messageId": "uuid",
  "rating": 5,
  "comment": "Ajudou"
}
```

## Endpoints Administrativos

Exigem perfil `gestao/admin`.

- `GET /functions/v1/admin-ai/dashboard`
- `POST /functions/v1/admin-ai/chat`
- `GET|POST /functions/v1/admin-ai/instructions`
- `PUT /functions/v1/admin-ai/instructions/:id`
- `PATCH /functions/v1/admin-ai/instructions/:id/deactivate`
- `GET|POST /functions/v1/admin-ai/knowledge`
- `PUT /functions/v1/admin-ai/knowledge/:id`
- `PATCH /functions/v1/admin-ai/knowledge/:id/deactivate`
- `GET|POST /functions/v1/admin-ai/faqs`
- `PUT /functions/v1/admin-ai/faqs/:id`
- `PATCH /functions/v1/admin-ai/faqs/:id/deactivate`
- `POST /functions/v1/admin-ai/corrections`
- `GET /functions/v1/admin-ai/conversations`
- `GET /functions/v1/admin-ai/logs`

## Area Administrativa

No frontend, entre com perfil de gestao e acesse `Assistente IA` no menu lateral.

La e possivel:

- Conversar com a IA administrativa.
- Cadastrar conhecimento.
- Cadastrar FAQs.
- Cadastrar instrucoes por escopo.
- Selecionar uma instrucao, editar, desativar e consultar versoes salvas.
- Salvar correcoes por `messageId`.
- Ver dashboard e logs recentes.

## Arquitetura

Principais arquivos:

- `src/lib/aiApi.ts`: cliente HTTP dos endpoints de IA.
- `src/pages/AssistenteIA.tsx`: area administrativa.
- `supabase/functions/_shared/ai/provider.ts`: `AiProviderService`, texto e embeddings.
- `supabase/functions/_shared/ai/agents.ts`: agentes especializados e orquestrador.
- `supabase/functions/_shared/ai/prompts.ts`: prompts internos.
- `supabase/functions/_shared/ai/security.ts`: sanitizacao, auth e protecoes.
- `supabase/functions/_shared/ai/repository.ts`: acesso controlado ao banco.

Fluxo:

Usuario/Admin -> Frontend -> Supabase Edge Function -> Agente -> Repositorio controlado -> Provedor de IA -> Validacao/log -> Frontend.

## Limitacoes Do MVP

- Busca semantica inicial usa `pgvector`; ainda nao ha chunking avancado, re-ranking ou painel de reprocessamento de embeddings.
- Fine-tuning real nao foi implementado.
- A tela administrativa cria itens e lista registros principais; edicao visual completa pode ser refinada depois.
- As Edge Functions precisam ser publicadas no Supabase para os endpoints responderem.
- O provider implementado e OpenAI-compatible via Chat Completions.

## Evolucao Recomendada

- Adicionar embeddings em `ai_knowledge_documents` e `ai_faqs`.
- Criar chunking por documento, re-ranking e jobs para reprocessar embeddings.
- Adicionar fila de revisao para respostas com baixa nota.
- Adicionar editor visual de versoes de instrucoes.
- Separar environments de homologacao/producao para prompts e secrets.
