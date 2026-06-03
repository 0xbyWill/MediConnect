# MediConnect — Clinical Sanctuary

> Sistema de gestão clínica desenvolvido com React + TypeScript + Vite.

---

## Estrutura atual

```text
src/
├── app/              # estados globais de UI e notificações
├── components/       # componentes de layout compartilhados
├── contexts/         # autenticação e providers React
├── features/         # lógicas por domínio
├── lib/              # API, HTTP client e integração Supabase
├── pages/            # telas da aplicação
├── shared/           # constantes, máscaras, validações e utilitários
├── types.ts          # tipos globais e mapeamento API/UI
├── App.tsx           # composição principal e navegação por estado
├── main.tsx          # entrada da aplicação
└── index.css         # estilos globais
```

## Padrões de formulários

Formulários validam no envio, exibem mensagens no fluxo e normalizam dados antes da API. CPF usa `digitsOnly`/`formatCpf`/`isValidCpf`; e-mail é salvo em lowercase; telefone e CEP usam utilitários de `src/shared/utils/validation.ts`; datas internas usam ISO `YYYY-MM-DD`.

Consulte `docs/form-patterns.md` e `AGENTS.md` para as convenções de manutenção.

## 🚀 Tecnologias utilizadas

- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) com HMR (Hot Module Replacement)
- [Lucide React](https://lucide.dev/) — ícones
- [ESLint](https://eslint.org/) — análise estática de código

---

## 📦 Plugins do Vite

Dois plugins oficiais estão disponíveis para uso com React:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) — utiliza o [Oxc](https://oxc.rs) para transformação rápida
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) — utiliza o [SWC](https://swc.rs/) como alternativa de alta performance

---

## ⚙️ Instalação e execução

```bash
# Instalar dependências
npm install

# Iniciar em modo desenvolvimento
npm run dev

# Gerar build de produção
npm run build

# Pré-visualizar build de produção
npm run preview
```

---

## 🔐 Perfis de acesso

Os acessos rapidos de demonstracao sao configurados por variaveis `VITE_DEMO_*` no `.env` local. Nao versionar senhas ou credenciais reais.

---

## 🗂️ Estrutura do projeto

```
src/
├── lib/
│   └── api.ts               # Camada de serviço — integração com Supabase
├── contexts/
│   └── AuthContext.tsx       # Contexto de autenticação com JWT
├── pages/
│   ├── Login.tsx             # Tela de login
│   ├── Dashboard.tsx         # Visão geral com KPIs
│   ├── Pacientes.tsx         # CRUD completo de pacientes
│   ├── Agenda.tsx            # Calendário e agendamentos
│   ├── Laudos.tsx            # Editor de laudos médicos
│   ├── Comunicacao.tsx       # Comunicação com pacientes
│   ├── Relatorios.tsx        # Relatórios e métricas
│   ├── Usuarios.tsx          # Gestão de usuários (perfil Gestão)
│   ├── Metricas.tsx          # Métricas de performance (perfil Gestão)
│   └── Configuracoes.tsx     # Configurações do sistema
├── components/
│   ├── Sidebar.tsx           # Menu lateral dinâmico por perfil
│   └── Topbar.tsx            # Barra superior com busca e perfil
├── types.ts                  # Tipagens globais e helpers de mapeamento
├── App.tsx                   # Roteamento por perfil e guard de autenticação
├── main.tsx                  # Entry point com AuthProvider
└── index.css                 # Variáveis CSS e estilos globais
```

---

## 🔧 React Compiler

O React Compiler não está habilitado neste template por impacto no desempenho de desenvolvimento e build. Para habilitá-lo, consulte a [documentação oficial](https://react.dev/learn/react-compiler/installation).

---

## 🛡️ Configuração do ESLint

Para aplicações em produção, recomenda-se habilitar regras de lint com reconhecimento de tipos. Atualize o arquivo `eslint.config.js`:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Substitua tseslint.configs.recommended por:
      tseslint.configs.recommendedTypeChecked,
      // Ou use esta opção para regras mais rígidas:
      tseslint.configs.strictTypeChecked,
      // Opcional: regras de estilo
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

Você também pode instalar os plugins adicionais para regras específicas do React:

- [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x)
- [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom)

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Habilita regras de lint para React
      reactX.configs['recommended-typescript'],
      // Habilita regras de lint para React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

---

## 🌐 Integração com API

O projeto se integra com o backend Supabase configurado em `VITE_SUPABASE_URL`.

A documentacao completa da API deve ser mantida em canal interno ou documentacao privada.

Endpoints disponíveis:

| Módulo | Endpoint |
|---|---|
| Autenticação | `POST /auth/v1/token` |
| Pacientes | `GET/POST/PATCH/DELETE /rest/v1/patients` |
| Agendamentos | `GET/POST/PATCH/DELETE /rest/v1/appointments` |
| Laudos | `GET/POST/PATCH/DELETE /rest/v1/reports` |
| Médicos | `GET /rest/v1/doctors` |

---

## Assistente IA

O MVP de IA foi adicionado usando Supabase Edge Functions, tabelas dedicadas e uma area administrativa no menu `Assistente IA` para usuarios de gestao.

Arquivos principais:

- `src/lib/aiApi.ts`: cliente dos endpoints de IA.
- `src/pages/AssistenteIA.tsx`: dashboard, chat admin, conhecimento, instrucoes, FAQs e correcoes.
- `supabase/migrations/202605060001_ai_mvp.sql`: schema, indices e RLS.
- `supabase/functions/ai/index.ts`: endpoints de usuario.
- `supabase/functions/admin-ai/index.ts`: endpoints administrativos.
- `supabase/functions/_shared/ai/*`: agentes, provider, prompts, seguranca e repositorio.

Variaveis das Edge Functions:

```env
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_PROVIDER=openai
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=700
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

Para Gemini, configure `AI_PROVIDER=gemini`, `GEMINI_API_KEY` e `GEMINI_MODEL` nos secrets das Edge Functions. Chaves de IA devem ficar somente no servidor; nao use variaveis publicas `VITE_*` para provedores de IA.

Endpoints:

- `POST /functions/v1/ai/generate-description`
- `POST /functions/v1/ai/generate-user-message`
- `POST /functions/v1/ai/support`
- `POST /functions/v1/ai/feedback`
- `GET|POST /functions/v1/admin-ai/instructions`
- `GET|POST /functions/v1/admin-ai/knowledge`
- `GET|POST /functions/v1/admin-ai/faqs`
- `POST /functions/v1/admin-ai/chat`
- `POST /functions/v1/admin-ai/corrections`
- `GET /functions/v1/admin-ai/conversations`
- `GET /functions/v1/admin-ai/logs`

Guia completo: [`docs/ai-mvp.md`](docs/ai-mvp.md).

Testes das Edge Functions:

```bash
npm run test:edge
```
