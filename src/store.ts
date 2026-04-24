import type { Paciente, Agendamento, Laudo } from './types';

const KEYS = {
  pacientes:    'mc_pacientes',
  agendamentos: 'mc_agendamentos',
  laudos:       'mc_laudos',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

const defaultPacientes: Paciente[] = [
  { id: '1', nome: 'Ana Beatriz Oliveira', cpf: '123.456.789-00', dataNasc: '1988-04-15', email: 'ana.beatriz@email.com', telefone: '(11) 99999-1111', convenio: 'Unimed Nacional', status: 'Ativo' },
  { id: '2', nome: 'Carlos Eduardo Silva', cpf: '987.654.321-11', dataNasc: '1975-09-22', email: 'carlos.silva@email.com', telefone: '(11) 99999-2222', convenio: 'Bradesco Saúde', status: 'Ativo' },
  { id: '3', nome: 'Fernanda Lima', cpf: '456.789.123-22', dataNasc: '1992-01-30', email: 'fernanda.lima@email.com', telefone: '(11) 98765-4321', convenio: 'Particular', status: 'Ativo' },
  { id: '4', nome: 'João Santos Neves', cpf: '789.123.456-33', dataNasc: '1960-12-08', email: 'joao.santos@email.com', telefone: '(11) 97777-3333', convenio: 'Amil S450', status: 'Inativo' },
  { id: '5', nome: 'Mariana Rodrigues', cpf: '321.654.987-44', dataNasc: '1995-07-17', email: 'mariana.r@email.com', telefone: '(11) 96666-4444', convenio: 'SulAmérica', status: 'Ativo' },
];

const today = new Date().toISOString().split('T')[0];

const defaultAgendamentos: Agendamento[] = [
  { id: 'a1', pacienteId: '1', data: today, hora: '09:00', tipo: 'Primeira Consulta', status: 'confirmado' },
  { id: 'a2', pacienteId: '3', data: today, hora: '09:30', tipo: 'Retorno', status: 'pendente' },
  { id: 'a3', pacienteId: '2', data: today, hora: '10:15', tipo: 'Check-up', status: 'confirmado' },
];

const defaultLaudos: Laudo[] = [
  { id: 'l1', pacienteId: '2', cid: 'I10', data: '2024-04-05', diagnostico: 'Monitoramento de hipertensão arterial sistêmica.', tecnica: 'Eletrocardiograma + Holter 24h', impressao: 'Pressão controlada com medicação atual.', status: 'rascunho' },
  { id: 'l2', pacienteId: '1', cid: 'M54.5', data: '2024-03-12', diagnostico: 'Investigação de dor persistente em região lombar após esforço físico intenso.', tecnica: 'RX coluna lombar + exame clínico', impressao: 'Sem alterações estruturais significativas.', status: 'liberado' },
];

export const store = {
  // Pacientes
  getPacientes: (): Paciente[] => load(KEYS.pacientes, defaultPacientes),
  savePacientes: (data: Paciente[]) => save(KEYS.pacientes, data),
  addPaciente: (p: Omit<Paciente, 'id'>): Paciente => {
    const list = store.getPacientes();
    const novo = { ...p, id: Date.now().toString() };
    store.savePacientes([...list, novo]);
    return novo;
  },
  updatePaciente: (updated: Paciente) => {
    const list = store.getPacientes().map(p => p.id === updated.id ? updated : p);
    store.savePacientes(list);
  },
  deletePaciente: (id: string) => {
    store.savePacientes(store.getPacientes().filter(p => p.id !== id));
  },

  // Agendamentos
  getAgendamentos: (): Agendamento[] => load(KEYS.agendamentos, defaultAgendamentos),
  saveAgendamentos: (data: Agendamento[]) => save(KEYS.agendamentos, data),
  addAgendamento: (a: Omit<Agendamento, 'id'>): Agendamento => {
    const list = store.getAgendamentos();
    const novo = { ...a, id: Date.now().toString() };
    store.saveAgendamentos([...list, novo]);
    return novo;
  },
  updateAgendamento: (updated: Agendamento) => {
    const list = store.getAgendamentos().map(a => a.id === updated.id ? updated : a);
    store.saveAgendamentos(list);
  },
  deleteAgendamento: (id: string) => {
    store.saveAgendamentos(store.getAgendamentos().filter(a => a.id !== id));
  },

  // Laudos
  getLaudos: (): Laudo[] => load(KEYS.laudos, defaultLaudos),
  saveLaudos: (data: Laudo[]) => save(KEYS.laudos, data),
  addLaudo: (l: Omit<Laudo, 'id'>): Laudo => {
    const list = store.getLaudos();
    const novo = { ...l, id: Date.now().toString() };
    store.saveLaudos([...list, novo]);
    return novo;
  },
  updateLaudo: (updated: Laudo) => {
    const list = store.getLaudos().map(l => l.id === updated.id ? updated : l);
    store.saveLaudos(list);
  },
  deleteLaudo: (id: string) => {
    store.saveLaudos(store.getLaudos().filter(l => l.id !== id));
  },

  getPaciente: (id: string): Paciente | undefined =>
    store.getPacientes().find(p => p.id === id),

  initDefaults: () => {
    if (!localStorage.getItem(KEYS.pacientes)) save(KEYS.pacientes, defaultPacientes);
    if (!localStorage.getItem(KEYS.agendamentos)) save(KEYS.agendamentos, defaultAgendamentos);
    if (!localStorage.getItem(KEYS.laudos)) save(KEYS.laudos, defaultLaudos);
  }
};