# Roteiro de Teste MediConnect

Use este roteiro para testar qualquer ambiente do MediConnect do mesmo jeito, comparando squads em pé de igualdade. Em cada item, marque `PASSA`, `FALHA` ou `BLOQUEADO` e anote evidências quando necessário.

## Identificação

Ambiente (URL): https://medi-connect-virid.vercel.app/
Médico:     email francisco.squad04@gmail.com  senha Teste@123
Secretária: email secretaria.squad04@gmail.com  senha Teste@123
Gestor:     email hugo@popcode.com.br  senha hdoria
Paciente:   email patrickestrela@popcode.com  senha Teste@123
Data base usada nos agendamentos: 12/06/2026 

## Bloco 0 — Primeira impressão e acentuação

1. Abra a URL sem estar logado. Observe a landing/login.
2. Confira acentuação em telas visíveis: títulos, sidebar, botões, cards.
   - Esperado: tudo em pt-BR correto (Gestão, Saúde, Comunicação, Relatórios, Configurações, Não tem uma conta). Sem palavras sem acento.
3. Tente dar refresh numa URL interna depois de logar (ex: /agenda) e veja se cai em 404 do Vercel.
   - Esperado: a página recarrega normal, sem 404. Se der 404, falta catch-all rewrite no vercel.json.

## Bloco 1 — Login e RBAC por perfil

Faça login em cada perfil, um de cada vez, e mapeie a sidebar e o dashboard.

1. Médico: anote a sidebar e os KPIs. Veja se o nome e o cargo no topo batem.
2. Secretária: idem.
3. Gestor: idem.
4. Paciente: idem. Confirme que o cargo exibido é "Paciente" (e não outro papel).
   - Esperado: cada perfil vê só o que é dele. Médico não vê módulo de Usuários/Gestão. Paciente vê um portal próprio (minhas consultas, meus laudos), não a interface da secretária.
5. Logout em cada um: clique em sair, vá pro login e entre com outro usuário.
   - Esperado: toast de "sessão encerrada", form limpo, sem vazar dados do usuário anterior.

## Bloco 2 — CRUD de paciente com validação (perfil Secretária ou Gestor)

1. Vá em Pacientes e clique em Novo Paciente.
2. Salve com tudo vazio.
   - Esperado: o form bloqueia e marca os campos obrigatórios (nome, CPF, data de nascimento, email, celular).
3. Preencha CPF com número inválido (ex: 123.456.789-00) e email sem @.
   - Esperado: "CPF inválido" (valida dígito verificador) e "informe um e-mail válido".
4. Digite no CPF e no telefone só números.
   - Esperado: máscara aplicada na hora (000.000.000-00 e (00) 00000-0000).
5. Tente cadastrar um CPF que já existe.
   - Esperado: aviso de CPF já cadastrado. Veja se trava de verdade ou se deixa criar duplicado. Se deixar, é bug.
6. Cadastro mínimo: preencha só os obrigatórios com dados válidos e salve.
   - Esperado: cria o paciente e ele aparece na lista.
7. Cadastro completo: abra outro Novo Paciente e preencha todos os campos e abas (endereço, informações médicas, convênio, observações).
   - Esperado: salva tudo e o detalhe do paciente mostra os dados.
8. Abra o paciente criado, clique em editar, mude um campo e salve.
   - Esperado: o form abre preenchido, salva a alteração. Confira se as máscaras seguem aplicadas no editar.
9. Verifique se existe ação de excluir/inativar e o que ela faz.

Anote: quais campos do escopo existem (nome social, RG, raça, naturalidade, nacionalidade, profissão, foto, menor de idade) e quais faltam.

## Bloco 3 — CRUD de médico com validação (perfil Gestor)

1. Vá no módulo de Usuários (ou Médicos) e clique em Novo.
2. Salve vazio.
   - Esperado: bloqueia e indica o que falta.
3. Selecione o perfil Médico e veja se aparecem campos específicos (CRM, UF do CRM, especialidade).
   - Esperado: um sistema médico precisa de CRM e especialidade.
4. Teste validação de CPF inválido, email já existente, senha curta e especialidade vazia.
   - Esperado: cada erro é apontado.
5. Cadastre um médico válido completo e confirme na lista.
   - Esperado: aparece na lista com CRM e especialidade visíveis (se a coluna existir).
6. Tente cadastrar dois médicos com o mesmo CRM na mesma UF.
   - Esperado: bloqueia (CRM é único por UF). Se deixar duplicar, é bug.
7. Edite e tente excluir o médico criado.

## Bloco 4 — Disponibilidade do médico

1. Logue como médico e vá na Agenda (ou Minha disponibilidade).
2. Cadastre uma faixa: escolha um dia da semana, tipo (presencial/online), início, término e duração do slot. Deixe ativa.
   - Esperado: salva e lista a faixa.
3. Volte pra agenda e abra um dia que caia nesse dia da semana.
   - Esperado: os horários livres aparecem gerados conforme a faixa e a duração.
4. Anote o médico, o dia e os horários gerados (vai usar nos blocos 5 e 6).

## Bloco 5 — Agendamento no horário disponível (Secretária e Paciente)

Parte A, como Secretária:

1. Novo Agendamento. Busque um paciente, escolha o médico do bloco 4, a data certa e um horário livre. Salve.
   - Esperado: cria a consulta. Ela aparece na agenda e some/marca como ocupado o slot.
2. Logue como o médico e confira se a consulta aparece pra ele.

Parte B, como Paciente:

3. Logue como paciente e tente Novo Agendamento.
   - Esperado: o paciente agenda pra si mesmo (sem precisar escolher qual paciente é). Confira se ele só enxerga a própria agenda.
4. Escolha o médico, a data e um horário livre. Salve.
   - Esperado: cria a consulta e ela aparece em "minhas consultas".
5. Confira se a lista de médicos que o paciente vê é a mesma que a secretária vê.
   - Esperado: mesma lista. Se um médico com disponibilidade aparece pra um e não pro outro, é bug de escopo.

## Bloco 6 — Casos de erro de agendamento

1. Conflito: tente marcar uma segunda consulta no mesmo médico, mesma data e mesmo horário já ocupado.
   - Esperado: bloqueia com mensagem clara ("médico já possui consulta neste horário"). Se deixar marcar duas no mesmo slot, é bug.
2. Fora da disponibilidade: tente marcar num dia/horário em que o médico não tem faixa ativa.
   - Esperado: o sistema não oferece o horário (dropdown vazio ou "sem disponibilidade"), ou bloqueia no submit. Se deixar marcar fora da disponibilidade, é bug.
3. Slot ocupado na visão do dia: veja se um horário já preenchido ainda mostra botão de Agendar.
   - Esperado: idealmente o slot ocupado não oferece Agendar, ou avisa antes.

## Bloco 7 — Signup público de paciente

1. No login, clique em Criar Conta.
   - Esperado: cria só conta de paciente (não médico/secretária), com magic link ou senha.
2. Preencha e envie.
   - Esperado: mensagem de sucesso e (se magic link) instrução pra confirmar por email. Se exigir email, anote que o fluxo completo precisa de inbox.

## Bloco 8 — Mensagens de erro e copy

Durante todos os blocos, vá anotando:

- Mensagens técnicas vazando pro usuário (erros 500 crus, nomes de constraint, "pela API", JSON do Supabase).
- Erros de validação que não limpam quando você corrige o campo.
- Placeholders ou labels errados.
- Dados de teste poluindo as listas (nomes tipo "teste", "asdasd", CPF/telefone crus, emails no campo nome).

## Bloco 9 — Laudo médico (criação, edição, PDF, assinatura)

1. Logue como médico, vá em Laudos (ou Relatórios médicos) e clique em Novo Laudo.
2. Anote o que o editor oferece: editor de texto rico (negrito, itálico, lista, imagem), campos clínicos (paciente, CID-10, data do exame, solicitante, técnica), modelos prontos, frases salvas, importar PDF, digitação por voz.
3. Selecione um paciente do banco, escolha um tipo de laudo (Laudo Médico, Atestado Médico, Solicitação de Exames, Declaração de Comparecimento, Encaminhamento), preencha CID e conclusão e salve como Rascunho.
   - Esperado: o rascunho aparece na lista de laudos com status Rascunho.
4. Reabra o rascunho, edite um campo e clique em Pré-visualizar.
   - Esperado: prévia formatada com cabeçalho, paciente, CID, corpo, data e linha de assinatura.
5. Clique em Liberar Laudo (ou Concluir/Assinar).
   - Esperado: status muda pra Liberado/Concluído e o PDF fica disponível pra baixar.
6. Gere o PDF.
   - Esperado: arquivo bem diagramado, sem caixas vazias, com a assinatura do médico (digital ou imagem) ou aviso claro de que a assinatura digital ainda não existe nesta versão.
7. Logue como paciente e confirme que o laudo aparece em Meus Laudos.
8. Logue como secretária e gestor.
   - Esperado: o laudo aparece na listagem global com filtros funcionando (paciente, status, tipo, data, médico solicitante).
9. Tente excluir ou anular um laudo já liberado.
   - Esperado: o sistema bloqueia ou exige justificativa, porque laudo liberado é registro clínico.

Bugs a procurar: CID malformado (vírgula em vez de ponto, ou sem letra como exige o CID-10), solicitante mostrando UUID em vez de nome, campos obrigatórios sem validação, PDF cortado ou sem cabeçalho, ausência de assinatura digital.

## Bloco 10 — Funcionalidades com IA

O escopo do MediConnect cita IA preditiva e assistente. Vale identificar o que existe de verdade e o que é placeholder.

1. Mapeie todas as pistas de IA no sistema, rodando em todos os perfis: chatbot ou widget no canto da tela, item de sidebar tipo Assistente IA, banner de "alerta preditivo" no dashboard, botão de IA dentro do editor de laudo, transcrição ou digitação por voz, sumarização de prontuário ou consulta, geração de imagem ou vídeo.
2. Pra cada funcionalidade encontrada, anote: onde fica (rota e perfil), o que faz, se responde de verdade quando você interage ou se é texto fixo, qual modelo ou serviço usa (olhe no Network do DevTools quando interagir; cabeçalhos ou URL podem revelar OpenAI, Anthropic, Vertex, modelo próprio).
3. Teste cada uma:
   - Chatbot: faça uma pergunta clínica simples ("quais sintomas de hipertensão?"). Veja se responde com conteúdo plausível, se mantém contexto entre mensagens e se avisa que não é orientação médica.
   - Geração de laudo por IA: dentro do editor de laudo, procure botão "Gerar com IA", "Sugerir conclusão" ou similar. Confira se o texto gerado faz sentido pro tipo de laudo escolhido.
   - Digitação por voz: clique no microfone, fale uma frase em português, confirme se transcreve no idioma certo e se manda o texto pro campo certo.
   - Alerta preditivo de no-show: veja se o texto no dashboard cita pacientes reais com risco calculado ou se é texto fixo igual pra todo mundo.
   - Sumarização: dentro do prontuário ou da consulta, procure botão de resumir.
   - Geração de vídeo ou imagem: pouco comum nesse escopo, mas anote se existir.
4. Capture um trecho de saída de cada IA testada pra anexar no relatório.
5. Se a IA chama endpoint próprio, anote no Network do DevTools qual URL é chamada e qual o status retornado. Erros como "Failed to fetch", 401 ou 500 são bugs a reportar.

Esperado mínimo: pelo menos uma funcionalidade de IA implementada de verdade (não só placeholder), com mensagem honesta quando estiver em modo demo, e com a integração visível (modelo, serviço ou aviso claro).

## Checklist final por squad

| Item | Resultado |
|------|-----------|
| Acentuação correta | |
| Refresh sem 404 | |
| RBAC por perfil coerente (médico, secretária, gestor, paciente) | |
| Logout limpa sessão | |
| Validação no CRUD de paciente (obrigatórios, CPF, email, máscaras) | |
| CPF único de verdade | |
| CRUD de médico com CRM/UF/especialidade | |
| CRM único por UF | |
| Disponibilidade do médico gera horários | |
| Secretária agenda no horário livre | |
| Paciente agenda no horário livre | |
| Conflito de horário bloqueado | |
| Fora da disponibilidade bloqueado | |
| Signup de paciente | |
| Laudo: rascunho → liberado → PDF | |
| Laudo aparece pro paciente e na listagem global | |
| IA: funcionalidades mapeadas | |
| IA: pelo menos uma respondendo de verdade | |
| Sem erro técnico cru na tela | |
| Sem dado de teste poluindo | |