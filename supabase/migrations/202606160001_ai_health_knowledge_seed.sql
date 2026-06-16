-- Seed de conhecimento em saude para a IA do MediConnect
-- Embeddings serao gerados quando o admin editar/salvar via painel ou proximo deploy com job de embedding.

insert into public.ai_knowledge_documents (title, category, content, active)
select * from (values
  (
    'Preparo para exames de sangue',
    'educacao_em_saude',
    'Para exames de sangue comuns (hemograma, glicemia, lipidograma), geralmente recomenda-se jejum de 8 a 12 horas, conforme orientacao do laboratorio. Evite exercicio intenso na véspera. Informe medicamentos em uso. Sempre confirme o preparo especifico com a unidade de coleta ou seu medico solicitante.',
    true
  ),
  (
    'Estrutura de laudos medicos',
    'educacao_em_saude',
    'Laudos medicos costumam seguir secoes: Achados (descricao objetiva do exame), Analise (interpretacao tecnica do medico), Conclusao (sintese) e Recomendacoes (proximos passos). A interpretacao final e responsabilidade do medico assistente; pacientes devem tirar duvidas em consulta.',
    true
  ),
  (
    'Direitos basicos do paciente',
    'educacao_em_saude',
    'No Brasil, pacientes tem direito a informacao clara, sigilo, consentimento informado, acesso ao prontuario conforme legislacao e segunda opiniao medica. Duvidas sobre direitos podem ser esclarecidas com a equipe de saude ou ouvidoria da instituicao.',
    true
  ),
  (
    'Quando procurar atendimento de urgencia',
    'educacao_em_saude',
    'Procure pronto-socorro ou ligue 192 (SAMU) em casos como dor toracica intensa, falta de ar importante, desmaio, confusao mental aguda, sangramento abundante ou deficit neurologico subito. Na duvida, priorize atendimento presencial.',
    true
  ),
  (
    'Como usar laudos no MediConnect',
    'uso_do_sistema',
    'Laudos liberados pelo medico ficam disponiveis na area Registro/Laudos do paciente. Laudos em elaboracao ou revisao ainda nao aparecem. Para entender o conteudo clinico, agende retorno com o medico responsavel.',
    true
  )
) as seed(title, category, content, active)
where not exists (
  select 1 from public.ai_knowledge_documents d where d.title = seed.title
);

insert into public.ai_faqs (question, answer, category, active)
select * from (values
  (
    'O que significa hemograma?',
    'Hemograma e um exame de sangue que avalia celulas como hemacias, leucocitos e plaquetas. Cada parametro tem faixa de referencia; a interpretacao depende do seu historico clinico e deve ser feita pelo medico.',
    'educacao_em_saude',
    true
  ),
  (
    'Preciso de jejum para exame de sangue?',
    'Muitos exames de sangue pedem jejum de 8 a 12 horas, mas isso varia conforme o exame solicitado. Confirme sempre com o laboratorio ou com a secretaria antes da coleta.',
    'educacao_em_saude',
    true
  ),
  (
    'A Panaceia pode interpretar meu laudo?',
    'A Panaceia pode explicar o que significam as secoes de um laudo (Achados, Analise, Conclusao), mas nao interpreta resultados do seu caso. Para entender seu laudo, converse com o medico que solicitou ou liberou o exame.',
    'uso_do_sistema',
    true
  ),
  (
    'Como me preparo para uma consulta?',
    'Chegue com antecedencia, leve documento com foto, cartao do convenio, lista de medicamentos e exames anteriores relevantes. Anote sintomas com data de inicio para discutir com o medico.',
    'educacao_em_saude',
    true
  ),
  (
    'O que e glicemia?',
    'Glicemia mede a quantidade de acucar no sangue. Valores de referencia variam conforme se o exame foi em jejum ou nao. Somente o medico pode avaliar o resultado no contexto do seu caso.',
    'educacao_em_saude',
    true
  )
) as seed(question, answer, category, active)
where not exists (
  select 1 from public.ai_faqs f where f.question = seed.question
);

insert into public.ai_instructions (title, content, scope, active)
select * from (values
  (
    'Educacao em saude permitida',
    'Voce pode explicar termos medicos de forma geral, orientar preparo para consultas e exames, descrever a estrutura de laudos e informar sobre direitos do paciente e saude preventiva. Nunca diagnostique, prescreva ou interprete resultados individuais do paciente.',
    'support',
    true
  ),
  (
    'Tom acolhedor Panaceia',
    'Use linguagem clara, empatica e respeitosa. Trate o paciente pelo primeiro nome quando disponivel. Seja util e completo, mas sempre lembre que orientacao clinica personalizada deve vir do medico.',
    'general',
    true
  )
) as seed(title, content, scope, active)
where not exists (
  select 1 from public.ai_instructions i where i.title = seed.title
);
