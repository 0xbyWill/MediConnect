# Padroes de formularios e validacao

## Campos revisados
- Login: e-mail, senha e toggle de senha.
- Cadastro publico de paciente: nome, e-mail, CPF, telefone e nascimento.
- Pacientes: busca, filtros, cadastro completo, upload de foto, documentos, contato, endereco, dados medicos, convenio e observacoes.
- Agenda: filtros, paciente, medico, data, horario, tipo e observacoes.
- Laudos: busca, editor rico, titulo, paciente, campos clinicos, uploads de imagem/PDF e toggles.
- Comunicacao: canal, busca/selecionador de paciente, modelos e mensagem.
- Usuarios: busca/filtro, nome, e-mail, telefone, perfil, CPF, CRM, UF, especialidade, senha e status.

## Padrões aplicados
- CPF em formato `000.000.000-00` na UI e apenas digitos ao salvar.
- Telefone brasileiro com DDD na UI e apenas digitos ao enviar para API/SMS.
- CEP em formato `00000-000` na UI e apenas digitos ao salvar.
- E-mail normalizado com `trim().toLowerCase()`.
- Imagens limitadas a JPG, PNG ou WebP, ate 2 MB.
- PDFs limitados a `application/pdf`, ate 10 MB.

## Diretriz incremental
As paginas ainda possuem muito estado e UI local. Prefira melhorias por modulo, validando `npm run lint` e `npm run build` a cada etapa. Evite mover arquivos grandes sem atualizar imports e testar o fluxo afetado.
