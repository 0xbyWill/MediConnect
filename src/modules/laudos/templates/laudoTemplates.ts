export type LaudoTemplateCategory =
  | 'Clínica Médica'
  | 'Cardiologia'
  | 'Endocrinologia'
  | 'Pneumologia'
  | 'Psiquiatria'
  | 'Ortopedia'
  | 'Medicina do Trabalho'
  | 'Ginecologia/Obstetricia'
  | 'Pediatria'
  | 'Solicitação de Exames'
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
  nomeMédico?: string;
  crm?: string;
  especialidadeMédico?: string;
  cid?: string;
  diagnostico?: string;
  tempoAcompanhamento?: string;
  conduta?: string;
  limitacoes?: string;
  exames?: string;
  observações?: string;
  peso?: string;
  altura?: string;
  imc?: string;
  allowCid?: boolean;
}

export const LAUDO_TEMPLATES: LaudoTemplate[] = [
  {
    id: 'has-acompanhamento',
    title: 'Hipertensão Arterial Sistêmica',
    category: 'Cardiologia',
    cid: 'I10',
    requiresCidConsent: true,
    tags: ['hipertensao', 'pressao alta', 'HAS', 'cronico'],
    preview: 'Laudo de acompanhamento para paciente com Hipertensão Arterial Sistêmica.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro, para os devidos fins, que o(a) paciente acima identificado(a) encontra-se em acompanhamento médico por Hipertensão Arterial Sistêmica.

Diagnóstico/hipótese clínica: Hipertensão Arterial Sistêmica [CID]
Tempo de acompanhamento: [TEMPO_ACOMPANHAMENTO]

Quadro clinico atual:
Paciente em acompanhamento clínico, com necessidade de monitorização periódica da pressão arterial, avaliação de fatores de risco cardiovasculares, adesão terapêutica e acompanhamento de exames complementares quando indicados.

Conduta/recomendações:
[CONDUTA]

Limitações ou observações:
[LIMITACOES]

Este documento foi emitido com base nas informações clínicas disponíveis nesta data e deve ser revisado conforme evolução clínica.

`,
  },
  {
    id: 'dm2-acompanhamento',
    title: 'Diabetes Mellitus Tipo 2',
    category: 'Endocrinologia',
    cid: 'E11',
    requiresCidConsent: true,
    tags: ['diabetes', 'DM2', 'glicemia', 'HbA1c'],
    preview: 'Laudo para acompanhamento clínico de Diabetes Mellitus Tipo 2.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento médico por Diabetes Mellitus Tipo 2.

Diagnóstico/hipótese clínica: Diabetes Mellitus Tipo 2 [CID]
Tempo de acompanhamento: [TEMPO_ACOMPANHAMENTO]

Informações clínicas relevantes:
Glicemia de jejum: [VALOR] mg/dL
HbA1c: [VALOR]%
Médicações em uso: [CONDUTA]

Recomendações:
Manter seguimento clínico regular, controle metabólico, avaliação de fatores de risco cardiovasculares e acompanhamento de exames laboratoriais conforme indicação médica.

Observações:
[OBSERVACOES]

`,
  },
  {
    id: 'asma-bronquica',
    title: 'Asma Brônquica',
    category: 'Pneumologia',
    cid: 'J45',
    requiresCidConsent: true,
    tags: ['asma', 'broncoespasmo', 'dispneia', 'respiratório'],
    preview: 'Laudo de acompanhamento para asma bronquica.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento por quadro respiratório compatível com Asma Brônquica.

Diagnóstico/hipótese clínica: Asma Brônquica [CID]
Classificação clínica: [LEVE/MODERADA/GRAVE]
Frequência de sintomas: [INFORMAR]

Quadro clinico:
Paciente com histórico de sintomas respiratórios recorrentes, podendo apresentar dispneia, tosse, sibilância e/ou sensação de aperto torácico, conforme avaliação clínica.

Conduta/recomendações:
[CONDUTA]

Observações:
[OBSERVACOES]

`,
  },
  {
    id: 'episodio-depressivo',
    title: 'Episódio Depressivo',
    category: 'Psiquiatria',
    cid: 'F32',
    requiresCidConsent: true,
    tags: ['depressão', 'humor', 'psiquiatria', 'saúde mental'],
    preview: 'Laudo para acompanhamento de episodio depressivo.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento médico por quadro compatível com Episódio Depressivo.

Diagnóstico/hipótese clínica: Episódio Depressivo [CID]
Gravidade clínica: [LEVE/MODERADO/GRAVE]
Tempo de acompanhamento: [TEMPO_ACOMPANHAMENTO]

Quadro clinico:
Paciente apresenta sintomas relacionados ao humor, energia, sono, apetite, concentração e funcionamento global, conforme avaliação clínica realizada.

Conduta/recomendações:
[CONDUTA]

Limitações funcionais, se houver:
[LIMITACOES]

Observações:
[OBSERVACOES]

`,
  },
  {
    id: 'ansiedade',
    title: 'Transtorno de Ansiedade',
    category: 'Psiquiatria',
    cid: 'F41',
    requiresCidConsent: true,
    tags: ['ansiedade', 'pânico', 'saúde mental', 'psiquiatria'],
    preview: 'Laudo para quadro ansioso em acompanhamento.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento por quadro ansioso, conforme avaliação clínica.

Diagnóstico/hipótese clínica: Transtorno de Ansiedade [CID]
Tempo de acompanhamento: [TEMPO_ACOMPANHAMENTO]

Descrição clínica:
O quadro pode envolver sintomas como ansiedade persistente, preocupação excessiva, alterações do sono, sintomas autonômicos, prejuízo funcional e/ou crises episódicas, conforme relato e exame clinico.

Conduta/recomendações:
[CONDUTA]

Observações:
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
    preview: 'Laudo de lombalgia com descrição de limitações funcionais.',
    body: `LAUDO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente foi avaliado(a) por quadro de dor lombar/lombalgia.

Diagnóstico/hipótese clínica: Dor lombar / Lombalgia [CID]
Inicio dos sintomas: [DATA_INICIO]
Exames relacionados: [EXAMES]

Descrição clínica:
Paciente apresenta dor em região lombar, com possível limitação funcional para atividades que envolvam esforço físico, flexao, extensao, carregamento de peso ou permanencia prolongada em determinadas posições, conforme avaliação médica.

Conduta/recomendações:
[CONDUTA]

Limitações:
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

Declaro que o(a) paciente encontra-se em acompanhamento médico por obesidade e/ou risco cardiometabolico.

Diagnóstico/hipótese clínica: Obesidade [CID]
Peso: [PESO] kg
Altura: [ALTURA] m
IMC: [IMC] kg/m2

Comorbidades associadas, se houver:
[OBSERVACOES]

Conduta/recomendações:
[CONDUTA]

`,
  },
  {
    id: 'solicitacao-exames-complementares',
    title: 'Solicitação de Exames Complementares',
    category: 'Solicitação de Exames',
    tags: ['exames', 'laboratorial', 'checkup', 'complementar'],
    preview: 'Modelo de solicitação de exames laboratoriais e complementares.',
    body: `SOLICITACAO DE EXAMES COMPLEMENTARES

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Solicito a realização dos seguintes exames, conforme avaliação clínica:

LABORATORIAIS:
[ ] Hemograma completo
[ ] Glicemia de jejum
[ ] HbA1c
[ ] Colesterol total e frações
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

Justificativa clínica:
[DIAGNOSTICO]

`,
  },
  {
    id: 'encaminhamento-especialista',
    title: 'Encaminhamento para Especialista',
    category: 'Encaminhamento',
    tags: ['encaminhamento', 'especialista', 'referencia'],
    preview: 'Modelo para encaminhamento médico com resumo clínico.',
    body: `ENCAMINHAMENTO MEDICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Encaminho o(a) paciente para avaliação com a especialidade: [ESPECIALIDADE_DESTINO].

Motivo do encaminhamento:
[DIAGNOSTICO]

Resumo clinico:
[OBSERVACOES]

Exames ja realizados:
[EXAMES]

Conduta ja realizada:
[CONDUTA]

Solicito avaliação especializada e orientação quanto a continuidade do acompanhamento.

`,
  },
  {
    id: 'apto-atividade-fisica',
    title: 'Avaliação de Aptidão para Atividade Física',
    category: 'Clínica Médica',
    tags: ['aptidão', 'atividade física', 'exercício', 'avaliação'],
    preview: 'Laudo simples de aptidão após avaliação clínica.',
    body: `LAUDO DE AVALIAÇÃO CLÍNICA

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente foi submetido(a) a avaliação clínica nesta data.

Após avaliação médica, no momento, [APTO/INAPTO/APTO COM RESTRIÇÕES] para prática de atividade física, considerando as informações clínicas disponíveis.

Restrições, se houver:
[LIMITACOES]

Observações:
[OBSERVACOES]

Este documento não substitui reavaliação médica em caso de surgimento de sintomas ou mudança do estado de saúde.

`,
  },
  {
    id: 'pre-operatorio',
    title: 'Avaliação Pré-operatória',
    category: 'Clínica Médica',
    tags: ['pré-operatório', 'cirurgia', 'risco', 'avaliação'],
    preview: 'Modelo de avaliação clínica pre-operatoria.',
    body: `AVALIAÇÃO PRE-OPERATORIA

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Procedimento previsto:
[PROCEDIMENTO]

Declaro que o(a) paciente foi avaliado(a) clínicamente para fins de avaliação pre-operatoria.

Antecedentes relevantes:
[OBSERVACOES]

Exames avaliados:
[EXAMES]

Médicações em uso:
[MEDICACOES]

Conclusão:
[CONDUTA]

Observações/restrições:
[LIMITACOES]

`,
  },
  {
    id: 'relatorio-circunstanciado',
    title: 'Relatorio Médico Circunstanciado',
    category: 'Clínica Médica',
    tags: ['relatorio', 'circunstanciado', 'acompanhamento', 'geral'],
    preview: 'Modelo geral para relatório médico detalhado.',
    body: `RELATÓRIO MEDICO CIRCUNSTANCIADO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Declaro que o(a) paciente encontra-se/foi atendido(a) em acompanhamento médico nesta unidade/consultório.

Histórico clínico:
[OBSERVACOES]

Diagnóstico ou hipótese clínica:
[DIAGNOSTICO]

Tempo de acompanhamento:
[TEMPO_ACOMPANHAMENTO]

Exames complementares:
[EXAMES]

Conduta terapeutica:
[CONDUTA]

Limitações funcionais, se aplicável:
[LIMITACOES]

Conclusão:
Documento emitido conforme avaliação clínica realizada e informações disponíveis nesta data.

`,
  },
  {
    id: 'alta-resumo-clinico',
    title: 'Resumo de Alta / Evolução Clínica',
    category: 'Alta/Resumo',
    tags: ['alta', 'resumo', 'evolução', 'continuidade'],
    preview: 'Resumo editável para alta, retorno ou continuidade do cuidado.',
    body: `RESUMO CLINICO

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Resumo do acompanhamento:
[OBSERVACOES]

Diagnóstico/hipótese clínica:
[DIAGNOSTICO]

Exames relevantes:
[EXAMES]

Conduta realizada e orientações:
[CONDUTA]

Sinais de alerta/orientações para retorno:
[LIMITACOES]

`,
  },
  {
    id: 'pediatria-acompanhamento-geral',
    title: 'Acompanhamento Pediatrico Geral',
    category: 'Pediatria',
    tags: ['pediatria', 'crescimento', 'desenvolvimento', 'acompanhamento'],
    preview: 'Modelo para acompanhamento pediatrico com orientações e observações clínicas.',
    body: `RELATÓRIO PEDIATRICO

Paciente: [NOME_DO_PACIENTE]
Idade: [IDADE]
Sexo: [SEXO]
Data: [DATA]

Declaro que o(a) paciente encontra-se em acompanhamento pediatrico.

Resumo clinico:
[DIAGNOSTICO]

Crescimento/desenvolvimento e observações relevantes:
[OBSERVACOES]

Exames ou avaliações complementares:
[EXAMES]

Conduta/orientações:
[CONDUTA]

`,
  },
  {
    id: 'medicina-trabalho-aptidao',
    title: 'Avaliação de Aptidão Ocupacional',
    category: 'Medicina do Trabalho',
    tags: ['ocupacional', 'aptidão', 'trabalho', 'restrições'],
    preview: 'Modelo para registro de aptidão ocupacional com restrições editáveis.',
    body: `RELATÓRIO DE AVALIAÇÃO OCUPACIONAL

Paciente: [NOME_DO_PACIENTE]
CPF: [CPF]
Data: [DATA]

Função/atividade avaliada:
[FUNCAO]

Com base na avaliação clínica e nas informações disponíveis, o(a) paciente encontra-se [APTO/INAPTO/APTO COM RESTRIÇÕES] para a atividade informada.

Restrições ou recomendações:
[LIMITACOES]

Exames considerados:
[EXAMES]

Observações:
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
    '[NOME_MEDICO]': data.nomeMédico,
    '[CRM]': data.crm,
    '[ESPECIALIDADE_MEDICO]': data.especialidadeMédico,
    '[CID]': data.allowCid ? data.cid : '',
    '[DIAGNOSTICO]': data.diagnostico,
    '[TEMPO_ACOMPANHAMENTO]': data.tempoAcompanhamento,
    '[CONDUTA]': data.conduta,
    '[LIMITACOES]': data.limitacoes,
    '[EXAMES]': data.exames,
    '[OBSERVACOES]': data.observações,
    '[PESO]': data.peso,
    '[ALTURA]': data.altura,
    '[IMC]': data.imc,
  };

  return Object.entries(values).reduce(
    (text, [placeholder, value]) => text.replaceAll(placeholder, value?.trim() || placeholder),
    template.body
  );
}
