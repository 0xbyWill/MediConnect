# MediConnect - Guia para agentes

## Stack
- React 19, TypeScript e Vite.
- Navegacao por estado em `src/App.tsx`; nao ha React Router.
- API Supabase via `src/lib/httpClient.ts` e `src/lib/api.ts`.
- Estilos globais e tokens em `src/index.css`.

## Estrutura
- `src/pages`: telas e fluxos principais.
- `src/components`: componentes de layout compartilhados, como Sidebar e Topbar.
- `src/app`: estados globais de UI e notificacoes.
- `src/contexts`: providers React, incluindo autenticacao.
- `src/lib`: cliente HTTP e camada de API.
- `src/features`: logicas isoladas por dominio.
- `src/shared`: constantes e utilitarios reutilizaveis.
- `src/types.ts`: tipos globais e mapeadores entre API e UI.

## Formularios
- Sempre associar label e campo quando alterar formularios (`htmlFor`/`id`).
- Exibir erros perto do campo quando possivel; erros globais devem usar `role="alert"`.
- Usar `disabled`/`saving` para evitar duplo envio.
- Preferir placeholders como exemplos, nunca como substitutos de labels.
- Usar `inputMode`, `autoComplete`, `min`, `max`, `step` e `maxLength` quando o tipo do dado permitir.

## Validacao e mascaras
- CPF: usar `digitsOnly`, `formatCpf` e `isValidCpf` de `src/shared/utils/cpf.ts`.
- Telefone BR, CEP, e-mail, uploads e decimais: usar `src/shared/utils/validation.ts`.
- Salvar e-mail com `trim().toLowerCase()`.
- Enviar CPF, telefone e CEP sem mascara quando a API exigir.
- Manter datas internas em ISO `YYYY-MM-DD`.
- Validar uploads no frontend por MIME e tamanho, mas nao depender disso como unica barreira.

## Comandos
- `npm run dev`: inicia o Vite.
- `npm run lint`: executa ESLint.
- `npm run build`: roda TypeScript e gera build.
- `npm run preview`: serve o build.
