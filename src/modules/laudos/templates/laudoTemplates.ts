export type LaudoTemplateCategory =
  | 'Clinica Medica'
  | 'Cardiologia'
  | 'Endocrinologia'
  | 'Pneumologia'
  | 'Psiquiatria'
  | 'Ortopedia'
  | 'Medicina do Trabalho'
  | 'Ginecologia/Obstetricia'
  | 'Pediatria'
  | 'Solicitacao de Exames'
  | 'Encaminhamento'
  | 'Alta/Resumo';

export interface LaudoTemplate {
  id: string;
  title: string;
  category: LaudoTemplateCategory;
  cid?: string;
  tags: string[];
  preview: string;
  requiresCidConsent?: boolean;
  body: string;
}

export interface LaudoTemplatePlaceholderData {
  nomePaciente?: string;
  cpf?: string;
  data?: string;
  idade?: string;
  sexo?: string;
  nomeMedico?: string;
  crm?: string;
  especialidadeMedico?: string;
  cid?: string;
  diagnostico?: string;
  tempoAcompanhamento?: string;
  conduta?: string;
  limitacoes?: string;
  exames?: string;
  observacoes?: string;
  peso?: string;
  altura?: string;
  imc?: string;
  allowCid?: boolean;
}

export const LAUDO_TEMPLATES: LaudoTemplate[] = [
  {
    id: 'has-acompanhamento',
    title: 'Hipertensao Arterial Sistemica',
    category: 'Cardiologia',
    cid: 'I10',
    requiresCidConsent: true,
    tags: ['hipertensao', 'pressao alta', 'HAS', 'cronico'],
    preview: 'Laudo de acompanhamento para paciente com Hipertensao Arterial Sistemica.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro, para os devidos fins, que o(a) paciente acima identificado(a) encontra-se em acompanhamento medico por Hipertensao Arterial Sistemica.

Diagnostico/hipotese clinica: Hipertensao Arterial Sistemica [CID]
Tempo de acompanhamento: [TEMPO_ACOMPANHAMENTO]

Quadro clinico atual:
Paciente em acompanhamento clinico, com necessidade de monitorizacao periodica da pressao arterial, avaliacao de fatores de risco cardiovasculares, adesao terapeutica e acompanhamento de exames complementares quando indicados.

Conduta/recomendacoes:
[CONDUTA]

Limitacoes ou observacoes:
[LIMITACOES]

Este documento foi emitido com base nas informacoes clinicas disponiveis nesta data e deve ser revisado conforme evolucao clinica.

`,
  },
  {
    id: 'dm2-acompanhamento',
    title: 'Diabetes Mellitus Tipo 2',
    category: 'Endocrinologia',
    cid: 'E11',
    requiresCidConsent: true,
    tags: ['diabetes', 'DM2', 'glicemia', 'HbA1c'],
    preview: 'Laudo para acompanhamento clinico de Diabetes Mellitus Tipo 2.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento medico por Diabetes Mellitus Tipo 2.

Diagnostico/hipotese clinica: Diabetes Mellitus Tipo 2 [CID]
Tempo de acompanhamento: [TEMPO_ACOMPANHAMENTO]

Informacoes clinicas relevantes:
Glicemia de jejum: [VALOR] mg/dL
HbA1c: [VALOR]%
Medicacoes em uso: [CONDUTA]

Recomendacoes:
Manter seguimento clinico regular, controle metabolico, avaliacao de fatores de risco cardiovasculares e acompanhamento de exames laboratoriais conforme indicacao medica.

Observacoes:
[OBSERVACOES]

`,
  },
  {
    id: 'asma-bronquica',
    title: 'Asma Bronquica',
    category: 'Pneumologia',
    cid: 'J45',
    requiresCidConsent: true,
    tags: ['asma', 'broncoespasmo', 'dispneia', 'respiratorio'],
    preview: 'Laudo de acompanhamento para asma bronquica.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento por quadro respiratorio compativel com Asma Bronquica.

Diagnostico/hipotese clinica: Asma Bronquica [CID]
Classificacao clinica: [LEVE/MODERADA/GRAVE]
Frequencia de sintomas: [INFORMAR]

Quadro clinico:
Paciente com historico de sintomas respiratorios recorrentes, podendo apresentar dispneia, tosse, sibilancia e/ou sensacao de aperto toracico, conforme avaliacao clinica.

Conduta/recomendacoes:
[CONDUTA]

Observacoes:
[OBSERVACOES]

`,
  },
  {
    id: 'episodio-depressivo',
    title: 'Episodio Depressivo',
    category: 'Psiquiatria',
    cid: 'F32',
    requiresCidConsent: true,
    tags: ['depressao', 'humor', 'psiquiatria', 'saude mental'],
    preview: 'Laudo para acompanhamento de episodio depressivo.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento medico por quadro compativel com Episodio Depressivo.

Diagnostico/hipotese clinica: Episodio Depressivo [CID]
Gravidade clinica: [LEVE/MODERADO/GRAVE]
Tempo de acompanhamento: [TEMPO_ACOMPANHAMENTO]

Quadro clinico:
Paciente apresenta sintomas relacionados ao humor, energia, sono, apetite, concentracao e funcionamento global, conforme avaliacao clinica realizada.

Conduta/recomendacoes:
[CONDUTA]

Limitacoes funcionais, se houver:
[LIMITACOES]

Observacoes:
[OBSERVACOES]

`,
  },
  {
    id: 'ansiedade',
    title: 'Transtorno de Ansiedade',
    category: 'Psiquiatria',
    cid: 'F41',
    requiresCidConsent: true,
    tags: ['ansiedade', 'panico', 'saude mental', 'psiquiatria'],
    preview: 'Laudo para quadro ansioso em acompanhamento.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento por quadro ansioso, conforme avaliacao clinica.

Diagnostico/hipotese clinica: Transtorno de Ansiedade [CID]
Tempo de acompanhamento: [TEMPO_ACOMPANHAMENTO]

Descricao clinica:
O quadro pode envolver sintomas como ansiedade persistente, preocupacao excessiva, alteracoes do sono, sintomas autonomicos, prejuizo funcional e/ou crises episodicas, conforme relato e exame clinico.

Conduta/recomendacoes:
[CONDUTA]

Observacoes:
[OBSERVACOES]

`,
  },
  {
    id: 'dor-lombar',
    title: 'Dor Lombar / Lombalgia',
    category: 'Ortopedia',
    cid: 'M54',
    requiresCidConsent: true,
    tags: ['lombalgia', 'dor lombar', 'ortopedia', 'coluna'],
    preview: 'Laudo de lombalgia com descricao de limitacoes funcionais.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente foi avaliado(a) por quadro de dor lombar/lombalgia.

Diagnostico/hipotese clinica: Dor lombar / Lombalgia [CID]
Inicio dos sintomas: [DATA_INICIO]
Exames relacionados: [EXAMES]

Descricao clinica:
Paciente apresenta dor em regiao lombar, com possivel limitacao funcional para atividades que envolvam esforco fisico, flexao, extensao, carregamento de peso ou permanencia prolongada em determinadas posicoes, conforme avaliacao medica.

Conduta/recomendacoes:
[CONDUTA]

Limitacoes:
[LIMITACOES]

`,
  },
  {
    id: 'obesidade-acompanhamento',
    title: 'Obesidade / Risco Cardiometabolico',
    category: 'Endocrinologia',
    cid: 'E66',
    requiresCidConsent: true,
    tags: ['obesidade', 'IMC', 'cardiometabolico', 'metabolico'],
    preview: 'Laudo para acompanhamento de obesidade e risco cardiometabolico.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento medico por obesidade e/ou risco cardiometabolico.

Diagnostico/hipotese clinica: Obesidade [CID]
Peso: [PESO] kg
Altura: [ALTURA] m
IMC: [IMC] kg/m2

Comorbidades associadas, se houver:
[OBSERVACOES]

Conduta/recomendacoes:
[CONDUTA]

`,
  },
  {
    id: 'solicitacao-exames-complementares',
    title: 'Solicitacao de Exames Complementares',
    category: 'Solicitacao de Exames',
    tags: ['exames', 'laboratorial', 'checkup', 'complementar'],
    preview: 'Modelo de solicitacao de exames laboratoriais e complementares.',
    body: `SOLICITACAO DE EXAMES COMPLEMENTARES

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Solicito a realizacao dos seguintes exames, conforme avaliacao clinica:

LABORATORIAIS:
[ ] Hemograma completo
[ ] Glicemia de jejum
[ ] HbA1c
[ ] Colesterol total e fracoes
[ ] Triglicerideos
[ ] Ureia
[ ] Creatinina
[ ] TGO / TGP
[ ] TSH / T4 livre
[ ] Urina tipo I

IMAGEM/OUTROS:
[ ] Eletrocardiograma
[ ] Radiografia: [REGIAO]
[ ] Ultrassonografia: [REGIAO]
[ ] Outros: [EXAMES]

Justificativa clinica:
[DIAGNOSTICO]

`,
  },
  {
    id: 'encaminhamento-especialista',
    title: 'Encaminhamento para Especialista',
    category: 'Encaminhamento',
    tags: ['encaminhamento', 'especialista', 'referencia'],
    preview: 'Modelo para encaminhamento medico com resumo clinico.',
    body: `ENCAMINHAMENTO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Encaminho o(a) paciente para avaliacao com a especialidade: [ESPECIALIDADE_DESTINO].

Motivo do encaminhamento:
[DIAGNOSTICO]

Resumo clinico:
[OBSERVACOES]

Exames ja realizados:
[EXAMES]

Conduta ja realizada:
[CONDUTA]

Solicito avaliacao especializada e orientacao quanto a continuidade do acompanhamento.

`,
  },
  {
    id: 'apto-atividade-fisica',
    title: 'Avaliacao de Aptidao para Atividade Fisica',
    category: 'Clinica Medica',
    tags: ['aptidao', 'atividade fisica', 'exercicio', 'avaliacao'],
    preview: 'Laudo simples de aptidao apos avaliacao clinica.',
    body: `LAUDO DE AVALIACAO CLINICA

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente foi submetido(a) a avaliacao clinica nesta data.

Apos avaliacao medica, no momento, [APTO/INAPTO/APTO COM RESTRICOES] para pratica de atividade fisica, considerando as informacoes clinicas disponiveis.

Restricoes, se houver:
[LIMITACOES]

Observacoes:
[OBSERVACOES]

Este documento nao substitui reavaliacao medica em caso de surgimento de sintomas ou mudanca do estado de saude.

`,
  },
  {
    id: 'pre-operatorio',
    title: 'Avaliacao Pre-operatoria',
    category: 'Clinica Medica',
    tags: ['pre-operatorio', 'cirurgia', 'risco', 'avaliacao'],
    preview: 'Modelo de avaliacao clinica pre-operatoria.',
    body: `AVALIACAO PRE-OPERATORIA

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Procedimento previsto:
[PROCEDIMENTO]

Declaro que o(a) paciente foi avaliado(a) clinicamente para fins de avaliacao pre-operatoria.

Antecedentes relevantes:
[OBSERVACOES]

Exames avaliados:
[EXAMES]

Medicacoes em uso:
[MEDICACOES]

Conclusao:
[CONDUTA]

Observacoes/restricoes:
[LIMITACOES]

`,
  },
  {
    id: 'relatorio-circunstanciado',
    title: 'Relatorio Medico Circunstanciado',
    category: 'Clinica Medica',
    tags: ['relatorio', 'circunstanciado', 'acompanhamento', 'geral'],
    preview: 'Modelo geral para relatorio medico detalhado.',
    body: `RELATORIO MEDICO CIRCUNSTANCIADO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se/foi atendido(a) em acompanhamento medico nesta unidade/consultorio.

Historico clinico:
[OBSERVACOES]

Diagnostico ou hipotese clinica:
[DIAGNOSTICO]

Tempo de acompanhamento:
[TEMPO_ACOMPANHAMENTO]

Exames complementares:
[EXAMES]

Conduta terapeutica:
[CONDUTA]

Limitacoes funcionais, se aplicavel:
[LIMITACOES]

Conclusao:
Documento emitido conforme avaliacao clinica realizada e informacoes disponiveis nesta data.

`,
  },
  {
    id: 'alta-resumo-clinico',
    title: 'Resumo de Alta / Evolucao Clinica',
    category: 'Alta/Resumo',
    tags: ['alta', 'resumo', 'evolucao', 'continuidade'],
    preview: 'Resumo editavel para alta, retorno ou continuidade do cuidado.',
    body: `RESUMO CLINICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Resumo do acompanhamento:
[OBSERVACOES]

Diagnostico/hipotese clinica:
[DIAGNOSTICO]

Exames relevantes:
[EXAMES]

Conduta realizada e orientacoes:
[CONDUTA]

Sinais de alerta/orientacoes para retorno:
[LIMITACOES]

`,
  },
  {
    id: 'pediatria-acompanhamento-geral',
    title: 'Acompanhamento Pediatrico Geral',
    category: 'Pediatria',
    tags: ['pediatria', 'crescimento', 'desenvolvimento', 'acompanhamento'],
    preview: 'Modelo para acompanhamento pediatrico com orientacoes e observacoes clinicas.',
    body: `RELATORIO PEDIATRICO

Paciente: [NOME_DO_PACIENTE]
Idade: [IDADE]
Sexo: [SEXO]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento pediatrico.

Resumo clinico:
[DIAGNOSTICO]

Crescimento/desenvolvimento e observacoes relevantes:
[OBSERVACOES]

Exames ou avaliacoes complementares:
[EXAMES]

Conduta/orientacoes:
[CONDUTA]

`,
  },
  {
    id: 'medicina-trabalho-aptidao',
    title: 'Avaliacao de Aptidao Ocupacional',
    category: 'Medicina do Trabalho',
    tags: ['ocupacional', 'aptidao', 'trabalho', 'restricoes'],
    preview: 'Modelo para registro de aptidao ocupacional com restricoes editaveis.',
    body: `RELATORIO DE AVALIACAO OCUPACIONAL

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Funcao/atividade avaliada:
[FUNCAO]

Com base na avaliacao clinica e nas informacoes disponiveis, o(a) paciente encontra-se [APTO/INAPTO/APTO COM RESTRICOES] para a atividade informada.

Restricoes ou recomendacoes:
[LIMITACOES]

Exames considerados:
[EXAMES]

Observacoes:
[OBSERVACOES]

`,
  },
];

export const laudoTemplates = LAUDO_TEMPLATES;

export function getTemplateCategories(templates = LAUDO_TEMPLATES) {
  return Array.from(new Set(templates.map(template => template.category))).sort();
}

export function applyLaudoTemplatePlaceholders(template: LaudoTemplate, data: LaudoTemplatePlaceholderData) {
  const values: Record<string, string | undefined> = {
    '[NOME_DO_PACIENTE]': data.nomePaciente,
    '[CPF]': data.cpf,
    '[DATA]': data.data,
    '[IDADE]': data.idade,
    '[SEXO]': data.sexo,
    '[NOME_MEDICO]': data.nomeMedico,
    '[CRM]': data.crm,
    '[ESPECIALIDADE_MEDICO]': data.especialidadeMedico,
    '[CID]': data.allowCid ? data.cid : '',
    '[DIAGNOSTICO]': data.diagnostico,
    '[TEMPO_ACOMPANHAMENTO]': data.tempoAcompanhamento,
    '[CONDUTA]': data.conduta,
    '[LIMITACOES]': data.limitacoes,
    '[EXAMES]': data.exames,
    '[OBSERVACOES]': data.observacoes,
    '[PESO]': data.peso,
    '[ALTURA]': data.altura,
    '[IMC]': data.imc,
  };

  return Object.entries(values).reduce(
    (text, [placeholder, value]) => text.replaceAll(placeholder, value?.trim() || placeholder),
    template.body
  );
}
