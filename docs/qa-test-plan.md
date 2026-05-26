# Roteiro de Teste MediConnect

Use este roteiro para testar qualquer ambiente do MediConnect do mesmo jeito, comparando squads em pé de igualdade. Em cada item, marque `PASSA`, `FALHA` ou `BLOQUEADO` e anote evidências quando necessário.

## Identificação

| Campo | Valor |
|---|---|
| Ambiente/URL |  |
| Data do teste |  |
| Responsável |  |
| Navegador/dispositivo |  |
| Login Médico |  |
| Login Secretária |  |
| Login Gestor |  |
| Login Paciente |  |

## Bloco 0 — Primeira Impressão e Acentuação

| Status | Passo | O que observar | Resultado esperado | Observações |
|---|---|---|---|---|
|  | Abrir a URL sem estar logado | Landing/login | Tela carrega corretamente |  |
|  | Conferir acentuação em telas visíveis | Títulos, sidebar, botões, cards | Tudo em pt-BR correto, sem mojibake ou palavras sem acento |  |
|  | Fazer refresh em URL interna após login, ex.: `/agenda` | Comportamento do deploy | Recarrega normal, sem 404 do Vercel |  |

## Bloco 1 — Login e RBAC por Perfil

| Status | Perfil | Passo | Resultado esperado | Observações |
|---|---|---|---|---|
|  | Médico | Entrar e mapear sidebar/dashboard | Nome, cargo e KPIs batem; não vê módulo de Usuários |  |
|  | Secretária | Entrar e mapear sidebar/dashboard | Vê apenas módulos operacionais do perfil |  |
|  | Gestor | Entrar e mapear sidebar/dashboard | Vê módulos administrativos permitidos |  |
|  | Paciente | Entrar e mapear sidebar/dashboard | Cargo exibido como “Paciente”; vê portal próprio |  |
|  | Todos | Fazer logout e entrar com outro usuário | Toast de sessão encerrada, formulário limpo, sem dados do usuário anterior |  |

## Bloco 2 — CRUD de Paciente com Validação

Executar como Secretária ou Gestor.

| Status | Passo | Resultado esperado | Observações |
|---|---|---|---|
|  | Abrir Pacientes e clicar em Novo Paciente | Formulário abre corretamente |  |
|  | Salvar com tudo vazio | Bloqueia e marca nome, CPF, data de nascimento, e-mail e celular |  |
|  | Preencher CPF inválido `123.456.789-00` e e-mail sem `@` | Exibe “CPF inválido” e “informe um e-mail válido” |  |
|  | Digitar CPF e telefone só com números | Máscara aplicada durante digitação |  |
|  | Cadastrar CPF já existente | Exibe aviso de duplicidade; anotar se bloqueia de verdade ou permite duplicado |  |
|  | Cadastro mínimo com obrigatórios válidos | Cria e aparece na lista |  |
|  | Cadastro completo em todas as abas | Salva e detalhe mostra os dados |  |
|  | Editar campo de paciente existente | Form abre preenchido, salva, máscaras continuam corretas |  |
|  | Verificar excluir/inativar | Anotar comportamento real |  |
|  | Conferir escopo de campos | Anotar se existem: nome social, RG, raça, naturalidade, nacionalidade, profissão, foto, menor de idade |  |

## Bloco 3 — CRUD de Médico com Validação

Executar como Gestor.

| Status | Passo | Resultado esperado | Observações |
|---|---|---|---|
|  | Abrir Usuários/Médicos e clicar em Novo | Formulário abre corretamente |  |
|  | Salvar vazio | Bloqueia e indica campos ausentes |  |
|  | Selecionar perfil Médico | Aparecem CRM, UF do CRM e especialidade |  |
|  | Testar CPF inválido, e-mail já existente, senha curta e especialidade vazia | Cada erro é apontado perto do campo |  |
|  | Cadastrar médico válido | Aparece na lista com CRM e especialidade visíveis |  |
|  | Tentar CRM duplicado na mesma UF | Bloqueia; CRM é único por UF |  |
|  | Editar e excluir médico criado | Ações funcionam ou exibem erro claro |  |

## Bloco 4 — Disponibilidade do Médico

| Status | Passo | Resultado esperado | Observações |
|---|---|---|---|
|  | Logar como médico e abrir Agenda/Minha disponibilidade | Área de disponibilidade acessível |  |
|  | Cadastrar faixa com dia da semana, tipo, início, término e duração do slot | Faixa salva ativa |  |
|  | Abrir na agenda um dia correspondente | Horários livres gerados conforme faixa |  |
|  | Anotar médico, dia e horários gerados | Dados disponíveis para blocos 5 e 6 |  |

## Bloco 5 — Agendamento no Horário Disponível

### Parte A — Secretária

| Status | Passo | Resultado esperado | Observações |
|---|---|---|---|
|  | Novo Agendamento: buscar paciente, escolher médico, data e horário livre | Consulta criada |  |
|  | Logar como médico | Consulta aparece para ele |  |

### Parte B — Paciente

| Status | Passo | Resultado esperado | Observações |
|---|---|---|---|
|  | Logar como paciente e tentar Novo Agendamento | Agenda para si mesmo; enxerga só a própria agenda |  |
|  | Escolher médico, data e horário livre | Consulta criada e aparece em “minhas consultas” |  |
|  | Comparar lista de médicos com a da secretária | Médico com disponibilidade aparece para ambos |  |

## Bloco 6 — Casos de Erro de Agendamento

| Status | Passo | Resultado esperado | Observações |
|---|---|---|---|
|  | Marcar segunda consulta no mesmo médico, data e horário | Bloqueia conflito com mensagem clara |  |
|  | Marcar fora da disponibilidade | Horário não aparece ou bloqueia no submit |  |
|  | Ver slot ocupado na visão do dia | Horário preenchido não mostra botão Agendar |  |

## Bloco 7 — Signup Público de Paciente

| Status | Passo | Resultado esperado | Observações |
|---|---|---|---|
|  | No login, clicar em Criar Conta | Fluxo cria somente conta de paciente |  |
|  | Preencher e enviar | Mensagem de sucesso; se exigir e-mail, anotar dependência de inbox |  |

## Bloco 8 — Mensagens de Erro e Copy

Durante todos os blocos, anote ocorrências de:

| Status | Item | Observações |
|---|---|---|
|  | Mensagens técnicas vazando para usuário, como erro 500 cru, constraint, JSON ou nomes do Supabase |  |
|  | Erros de validação que não limpam ao corrigir campo |  |
|  | Placeholders ou labels errados |  |
|  | Dados de teste poluindo listas |  |

## Checklist Final

| Item | Resultado | Observações |
|---|---|---|
| Acentuação correta |  |  |
| Refresh sem 404 |  |  |
| RBAC por perfil coerente |  |  |
| Logout limpa sessão |  |  |
| Validação no CRUD de paciente |  |  |
| CPF único de verdade |  |  |
| CRUD de médico com CRM/UF/especialidade |  |  |
| CRM único por UF |  |  |
| Disponibilidade gera horários |  |  |
| Secretária agenda no horário livre |  |  |
| Paciente agenda no horário livre |  |  |
| Conflito de horário bloqueado |  |  |
| Fora da disponibilidade bloqueado |  |  |
| Signup de paciente |  |  |
| Sem erro técnico cru na tela |  |  |
| Sem dado de teste poluindo |  |  |
