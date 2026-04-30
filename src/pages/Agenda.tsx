import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, Calendar, CalendarCheck, Clock, Loader2, Mail, MapPin,
  Pencil, Phone, Plus, Search, Trash2, Users, X,
} from 'lucide-react';
import type { Agendamento, Paciente, TipoConsulta } from '../types';
import type { ApiDoctor } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO } from '../shared/utils/date';
import { initials } from '../shared/utils/text';

const TIPOS: TipoConsulta[] = ['Primeira Consulta', 'Retorno', 'Check-up', 'Urgência'];
const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 19; h++) {
  for (let m = 0; m < 60; m += 10) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

type FormData = Omit<Agendamento, 'id' | 'duracao'> & { id?: string };

interface AgendaProps {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  doctors?: ApiDoctor[];
  onAdd: (a: Omit<Agendamento, 'id'>) => Promise<void>;
  onUpdate: (a: Agendamento) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  initialOpen?: boolean;
  readOnly?: boolean;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return dateToISO(d);
}

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDateBR(iso: string) {
  if (!iso) return 'Sem data';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function emptyForm(date = dateToISO(new Date())): FormData {
  return {
    pacienteId: '',
    medicoId: '',
    data: date,
    hora: '',
    tipo: 'Primeira Consulta',
    status: 'pendente',
    observacoes: '',
    enviarEmail: true,
    enviarWhatsapp: true,
  };
}

function byChronology(a: Agendamento, b: Agendamento) {
  return `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`);
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--gray-600)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  display: 'block',
  marginBottom: 5,
};

const STATUS_LABEL: Record<Agendamento['status'], { label: string; bg: string; color: string }> = {
  confirmado: { label: 'Confirmada', bg: 'var(--mint)', color: 'var(--dark)' },
  pendente: { label: 'Pendente', bg: 'var(--amber-100)', color: 'var(--amber-600)' },
  cancelado: { label: 'Cancelada', bg: 'var(--red-100)', color: 'var(--red-600)' },
  realizado: { label: 'Realizada', bg: '#ede9fe', color: '#5b21b6' },
};

export default function Agenda({ agendamentos, pacientes, doctors = [], onAdd, onUpdate, onDelete, initialOpen, readOnly = false }: AgendaProps) {
  const { user } = useAuth();
  const isMedico = user?.role === 'medico';
  const isPaciente = user?.role === 'paciente' || readOnly;
  const today = dateToISO(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState<'dia' | 'semana' | 'mes' | 'todos'>('dia');
  const [filterDoctorId, setFilterDoctorId] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: FormData }>({
    open: false,
    mode: 'add',
    data: emptyForm(today),
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openModal = useCallback((appt?: Agendamento, dateOverride = selectedDate, timeOverride = '') => {
    if (isPaciente) return;
    setErrors({});
    setApiError('');
    if (appt) {
      setModal({
        open: true,
        mode: 'edit',
        data: {
          id: appt.id,
          pacienteId: appt.pacienteId,
          medicoId: appt.medicoId || '',
          data: appt.data,
          hora: appt.hora,
          tipo: appt.tipo,
          status: appt.status,
          observacoes: appt.observacoes || '',
          enviarEmail: false,
          enviarWhatsapp: false,
        },
      });
      setPatientSearch('');
      return;
    }
    setModal({ open: true, mode: 'add', data: { ...emptyForm(dateOverride), medicoId: filterDoctorId, hora: timeOverride } });
    setPatientSearch('');
  }, [filterDoctorId, isPaciente, selectedDate]);

  useEffect(() => {
    if (initialOpen && !isPaciente) openModal();
  }, [initialOpen, isPaciente, openModal]);

  const closeModal = () => {
    if (saving) return;
    setModal({ open: false, mode: 'add', data: emptyForm(selectedDate) });
    setErrors({});
    setApiError('');
  };

  const setField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setModal(m => ({ ...m, data: { ...m.data, [field]: value } }));
  };

  const activeDoctorId = isMedico ? user?.doctor_id || '' : filterDoctorId;
  const selectedPatient = pacientes.find(p => p.id === modal.data.pacienteId);
  const patientOptions = pacientes.filter(p => {
    const q = patientSearch.toLowerCase().trim();
    return !q || p.nome.toLowerCase().includes(q) || p.cpf.includes(q);
  });

  const periodStart = period === 'semana'
    ? startOfWeek(new Date(`${selectedDate}T00:00:00`))
    : period === 'mes'
    ? startOfMonth(new Date(`${selectedDate}T00:00:00`))
    : selectedDate;

  const filteredAppointments = agendamentos
    .filter(a => {
      const patient = pacientes.find(p => p.id === a.pacienteId);
      const q = filterPatient.toLowerCase().trim();
      const matchDoctor = !activeDoctorId || a.medicoId === activeDoctorId;
      const matchPatient = !q || patient?.nome.toLowerCase().includes(q) || patient?.cpf.includes(q);
      const matchPeriod =
        period === 'todos' ||
        (period === 'dia' && a.data === selectedDate) ||
        (period === 'semana' && a.data >= periodStart && a.data <= dateToISO(new Date(new Date(`${periodStart}T00:00:00`).getTime() + 6 * 86400000))) ||
        (period === 'mes' && a.data.slice(0, 7) === selectedDate.slice(0, 7));
      return matchDoctor && matchPatient && matchPeriod;
    })
    .sort(byChronology);

  const scheduledToday = agendamentos.filter(a => a.data === today).length;
  const uniquePatients = new Set(filteredAppointments.map(a => a.pacienteId)).size;
  const busiestHour = Object.entries(
    filteredAppointments.reduce<Record<string, number>>((acc, a) => {
      const hour = a.hora.slice(0, 2);
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const modalDoctorId = isMedico ? user?.doctor_id || '' : modal.data.medicoId || '';
  const dayConflicts = agendamentos.filter(a =>
    a.medicoId === modalDoctorId &&
    a.data === modal.data.data &&
    a.id !== modal.data.id
  );

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!modal.data.pacienteId) nextErrors.paciente = 'Selecione um paciente do banco.';
    if (!modal.data.data) nextErrors.data = 'Informe a data da consulta.';
    if (modal.data.data && modal.data.data < today) nextErrors.data = 'A consulta não pode ser agendada para data anterior a hoje.';
    if (!modal.data.hora) nextErrors.hora = 'Informe o horário.';
    if (!isMedico && !modal.data.medicoId) nextErrors.medico = 'Selecione um médico.';
    if (modal.data.hora && dayConflicts.some(a => a.hora === modal.data.hora)) {
      nextErrors.hora = 'Este médico já possui consulta neste horário.';
    }
    return nextErrors;
  };

  const handleSave = async () => {
    if (isPaciente) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setApiError('');
    try {
      const payload: Omit<Agendamento, 'id'> = {
        pacienteId: modal.data.pacienteId,
        medicoId: modalDoctorId,
        data: modal.data.data,
        hora: modal.data.hora,
        tipo: modal.data.tipo,
        observacoes: modal.data.observacoes,
        enviarEmail: modal.data.enviarEmail,
        enviarWhatsapp: modal.data.enviarWhatsapp,
        status: modal.data.status ?? 'pendente',
        duracao: '30 min',
      };

      if (modal.mode === 'add') await onAdd(payload);
      else await onUpdate({ ...payload, id: modal.data.id! });
      closeModal();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erro ao salvar agendamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isPaciente) return;
    if (!confirmDelete) return;
    try {
      await onDelete(confirmDelete);
      setConfirmDelete(null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erro ao excluir agendamento.');
      setConfirmDelete(null);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--background)', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--gray-100)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)', margin: 0 }}>Agenda</h1>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>
              {isPaciente ? 'Acompanhe suas consultas agendadas e anteriores.' : 'Consultas organizadas por data, horário e paciente cadastrado.'}
            </p>
          </div>
          {!isPaciente && !isMedico && (
            <button onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={16} /> Agendar
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <Metric label="Consultas filtradas" value={filteredAppointments.length} icon={CalendarCheck} />
          <Metric label="Hoje" value={scheduledToday} icon={Clock} />
          <Metric label="Pacientes no período" value={uniquePatients} icon={Users} />
          <Metric label="Horário de pico" value={busiestHour ? `${busiestHour[0]}h` : '—'} icon={Calendar} />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isMedico && (
            <select value={filterDoctorId} onChange={e => setFilterDoctorId(e.target.value)}
              style={{ minWidth: 220, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }}>
              <option value="">Todos os médicos</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` - ${d.specialty}` : ''}</option>)}
            </select>
          )}
          <input type="date" value={selectedDate} min={today} onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }} />
          <select value={period} onChange={e => setPeriod(e.target.value as typeof period)}
            style={{ padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }}>
            <option value="dia">Dia</option>
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
            <option value="todos">Todos</option>
          </select>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input value={filterPatient} onChange={e => setFilterPatient(e.target.value)} placeholder="Filtrar por paciente ou CPF..."
              style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
        {apiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
            <AlertCircle size={15} /> {apiError}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                {['Data', 'Paciente', 'Médico', 'Tipo', 'Observações', isPaciente ? 'Status' : 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map(appt => {
                const patient = pacientes.find(p => p.id === appt.pacienteId);
                const doctor = doctors.find(d => d.id === appt.medicoId);
                return (
                  <tr key={appt.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 800, color: 'var(--gray-800)' }}>{formatDateBR(appt.data)}</div>
                      <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 2 }}>{appt.hora}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--mint)', color: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {initials(patient?.nome || 'Paciente')}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div title={patient?.nome || ''} style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient?.nome || 'Paciente não encontrado'}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{patient?.cpf || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{doctor?.full_name || (isMedico ? user?.full_name : '—')}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'var(--mint)', color: 'var(--dark)' }}>{appt.tipo}</span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--gray-500)' }}>{appt.observacoes || '—'}</td>
                    <td style={tdStyle}>
                      {isPaciente ? (
                        <StatusBadge status={appt.status} />
                      ) : (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <IconButton title="Editar" icon={Pencil} color="var(--amber-600)" onClick={() => openModal(appt)} />
                        <IconButton title="Excluir" icon={Trash2} color="var(--red-500)" onClick={() => setConfirmDelete(appt.id)} />
                      </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '54px 24px', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <Calendar size={32} style={{ display: 'block', margin: '0 auto 10px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-600)' }}>Nenhuma consulta encontrada</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{isPaciente ? 'Quando houver consultas vinculadas ao seu perfil, elas aparecerao aqui.' : 'Ajuste os filtros ou crie um novo agendamento.'}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 'min(760px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>{modal.mode === 'add' ? 'Novo Agendamento' : 'Editar Agendamento'}</h2>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>Paciente e horário serão salvos usando dados reais da API.</p>
              </div>
              <button onClick={closeModal} disabled={saving} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--gray-100)', cursor: saving ? 'not-allowed' : 'pointer' }}><X size={15} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
              {apiError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                  <AlertCircle size={15} /> {apiError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Paciente <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  {selectedPatient ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--light)', borderRadius: 10, background: 'var(--mint)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{initials(selectedPatient.nome)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--dark)' }}>{selectedPatient.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{selectedPatient.cpf || '—'} · {selectedPatient.telefone || '—'}</div>
                      </div>
                      <button onClick={() => setField('pacienteId', '')} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                        <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Pesquisar paciente no banco..."
                          style={{ width: '100%', padding: '10px 12px 10px 34px', border: `1px solid ${errors.paciente ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)', outline: 'none' }} />
                      </div>
                      {patientSearch && (
                        <div style={{ marginTop: 5, maxHeight: 190, overflow: 'auto', border: '1px solid var(--gray-100)', borderRadius: 10, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
                          {patientOptions.slice(0, 10).map(p => (
                            <button key={p.id} onClick={() => { setField('pacienteId', p.id); setPatientSearch(''); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: 'none', background: '#fff', borderBottom: '1px solid var(--gray-50)', textAlign: 'left', cursor: 'pointer' }}>
                              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--mint)', color: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{initials(p.nome)}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>{p.nome}</div>
                                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.cpf || '—'} · {p.convenio}</div>
                              </div>
                            </button>
                          ))}
                          {patientOptions.length === 0 && <div style={{ padding: 14, fontSize: 12, color: 'var(--gray-400)' }}>Nenhum paciente encontrado.</div>}
                        </div>
                      )}
                    </>
                  )}
                  {errors.paciente && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.paciente}</span>}
                </div>

                {!isMedico && (
                  <div>
                    <label style={labelStyle}>Médico <span style={{ color: 'var(--red-500)' }}>*</span></label>
                    <select value={modal.data.medicoId || ''} onChange={e => setField('medicoId', e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.medico ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                      <option value="">Selecione o médico</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` - ${d.specialty}` : ''}</option>)}
                    </select>
                    {errors.medico && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.medico}</span>}
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Data <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <input type="date" min={today} value={modal.data.data} onChange={e => setField('data', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.data ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }} />
                  {errors.data && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.data}</span>}
                </div>

                <div>
                  <label style={labelStyle}>Horário <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <select value={modal.data.hora} onChange={e => setField('hora', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.hora ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                    <option value="">Selecione</option>
                    {TIME_SLOTS.map(slot => (
                      <option key={slot} value={slot} disabled={dayConflicts.some(a => a.hora === slot)}>
                        {slot}{dayConflicts.some(a => a.hora === slot) ? ' - ocupado' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.hora && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.hora}</span>}
                </div>

                <div>
                  <label style={labelStyle}>Tipo de consulta</label>
                  <select value={modal.data.tipo} onChange={e => setField('tipo', e.target.value as TipoConsulta)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                    {TIPOS.map(tipo => <option key={tipo}>{tipo}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Observações</label>
                  <textarea value={modal.data.observacoes || ''} onChange={e => setField('observacoes', e.target.value)} rows={4}
                    placeholder="Motivo da consulta, orientações e informações importantes..."
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, background: 'var(--gray-50)', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                {selectedPatient && (
                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                    <InfoPill icon={Phone} label="Telefone" value={selectedPatient.telefone || '—'} />
                    <InfoPill icon={Mail} label="E-mail" value={selectedPatient.email || '—'} />
                    <InfoPill icon={MapPin} label="Cidade" value={selectedPatient.cidade || '—'} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 24px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={closeModal} disabled={saving} style={{ padding: '9px 20px', border: '1px solid var(--gray-200)', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><CalendarCheck size={14} /> Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}>
            <AlertCircle size={24} color="var(--red-500)" />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-800)', margin: '12px 0 6px' }}>Excluir agendamento?</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.5 }}>Esta ação removerá a consulta da agenda.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 16px', border: '1px solid var(--gray-200)', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ padding: '9px 16px', border: 'none', borderRadius: 9, background: 'var(--red-500)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '13px 16px',
  fontSize: 13,
  color: 'var(--gray-600)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  verticalAlign: 'middle',
};

function Metric({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div style={{ border: '1px solid var(--gray-100)', background: 'var(--gray-50)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 20, color: 'var(--dark)', fontWeight: 800 }}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Agendamento['status'] }) {
  const st = STATUS_LABEL[status] ?? STATUS_LABEL.pendente;
  return (
    <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
      {st.label}
    </span>
  );
}

function IconButton({ title, icon: Icon, color, onClick }: { title: string; icon: React.ElementType; color: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={14} />
    </button>
  );
}

function InfoPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--gray-100)', background: '#fff', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
      <Icon size={14} color="var(--primary)" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--gray-700)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  );
}
