import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X, Check } from 'lucide-react';
import type { Agendamento, Paciente, TipoConsulta, StatusAgendamento } from '../types';
import { store } from '../store';

interface AgendaProps {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  onAdd: (a: Omit<Agendamento, 'id'>) => void;
  onUpdate: (a: Agendamento) => void;
  onDelete: (id: string) => void;
  initialOpen?: boolean;
}

const TIPOS: TipoConsulta[] = ['Primeira Consulta', 'Retorno', 'Check-up', 'Urgência'];
const STATUS_LIST: StatusAgendamento[] = ['confirmado', 'pendente', 'cancelado', 'realizado'];

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  confirmado: 'Confirmado', pendente: 'Pendente', cancelado: 'Cancelado', realizado: 'Realizado'
};

const TIPO_BADGE: Record<TipoConsulta, { bg: string; color: string }> = {
  'Primeira Consulta': { bg: 'var(--mint)', color: 'var(--dark)' },
  'Retorno': { bg: 'var(--amber-100)', color: 'var(--amber-600)' },
  'Check-up': { bg: '#e0f2fe', color: '#0369a1' },
  'Urgência': { bg: 'var(--red-100)', color: 'var(--red-600)' },
};

function formatDateISO(d: Date) {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const HOURS = Array.from({ length: 22 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

const emptyForm = { pacienteId: '', data: formatDateISO(new Date()), hora: '', tipo: 'Primeira Consulta' as TipoConsulta, status: 'confirmado' as StatusAgendamento, observacoes: '' };

export default function Agenda({ agendamentos, pacientes, onAdd, onUpdate, onDelete, initialOpen }: AgendaProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: Partial<Agendamento> }>({ open: false, mode: 'add', data: {} });
  const [selectedAppt, setSelectedAppt] = useState<Agendamento | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => { if (initialOpen) openModal(); }, []);

  const dateStr = formatDateISO(selectedDate);
  const dayAppts = agendamentos
    .filter(a => a.data === dateStr && (!filterStatus || a.status === filterStatus))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const waitAppts = agendamentos.filter(a => a.data === dateStr && a.status === 'pendente');

  const openModal = (appt?: Agendamento) => {
    setModal({ open: true, mode: appt ? 'edit' : 'add', data: appt ? { ...appt } : { ...emptyForm, data: dateStr } });
    setErrors({});
  };
  const closeModal = () => { setModal({ open: false, mode: 'add', data: {} }); setErrors({}); };

  const validate = (d: Partial<Agendamento>) => {
    const e: Record<string, string> = {};
    if (!d.pacienteId) e.pacienteId = 'Selecione um paciente';
    if (!d.hora) e.hora = 'Horário obrigatório';
    return e;
  };

  const handleSave = () => {
    const e = validate(modal.data);
    if (Object.keys(e).length) { setErrors(e); return; }
    if (modal.mode === 'add') onAdd(modal.data as Omit<Agendamento, 'id'>);
    else onUpdate(modal.data as Agendamento);
    closeModal();
  };

  const dayLabel = `${DAYS_PT[selectedDate.getDay()].toUpperCase()}, ${selectedDate.getDate()} DE ${MONTHS_PT[selectedDate.getMonth()].toUpperCase()}`;

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Agenda Médica</h1>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>Gerencie consultas e fila de espera</p>
          </div>
          <button onClick={() => openModal()} style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> + Novo Agendamento
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '6px 12px' }}>
            <button onClick={() => setSelectedDate(d => addDays(d, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-600)', display: 'flex' }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', minWidth: 90, textAlign: 'center' }}>
              {`${String(selectedDate.getDate()).padStart(2, '0')}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()}`}
            </span>
            <button onClick={() => setSelectedDate(d => addDays(d, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-600)', display: 'flex' }}><ChevronRight size={16} /></button>
          </div>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}>
            <option value="">Todos os status</option>
            {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {['Hoje', 'Dia', 'Semana', 'Mês'].map((v, i) => (
              <button key={v} onClick={() => i === 0 && setSelectedDate(new Date())}
                style={{ padding: '7px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: v === 'Hoje' ? 'var(--primary)' : '#fff', color: v === 'Hoje' ? '#fff' : 'var(--gray-600)' }}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, padding: '0 24px 24px' }}>
        {/* Timeline */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>{dayLabel}</span>
            <button onClick={() => openModal()} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--mint)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}><Plus size={14} /></button>
          </div>
          <div style={{ padding: '8px 0' }}>
            {HOURS.map(hour => {
              const appt = dayAppts.find(a => a.hora === hour);
              return (
                <div key={hour} style={{ display: 'flex', alignItems: 'flex-start', minHeight: 44 }}>
                  <div style={{ width: 60, flexShrink: 0, padding: '12px 12px 0', fontSize: 11, color: 'var(--gray-400)', fontWeight: 500, textAlign: 'right' }}>{hour}</div>
                  <div style={{ flex: 1, borderTop: '1px solid var(--gray-50)', margin: '0 8px', minHeight: 44, position: 'relative' }}>
                    {appt && (() => {
                      const p = store.getPaciente(appt.pacienteId);
                      const badge = TIPO_BADGE[appt.tipo];
                      const isSelected = selectedAppt?.id === appt.id;
                      return (
                        <div onClick={() => setSelectedAppt(isSelected ? null : appt)}
                          style={{ margin: '4px 0', padding: '8px 12px', background: isSelected ? 'var(--mint)' : 'var(--background)', borderLeft: `3px solid var(--primary)`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>{p?.nome || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{appt.tipo}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, ...badge }}>{appt.tipo}</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={e => { e.stopPropagation(); openModal(appt); }} style={{ width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-600)' }}><Pencil size={12} /></button>
                            <button onClick={e => { e.stopPropagation(); setConfirmDelete(appt.id); }} style={{ width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-500)' }}><Trash2 size={12} /></button>
                            {appt.status !== 'realizado' && (
                              <button onClick={e => { e.stopPropagation(); onUpdate({ ...appt, status: 'realizado' }); }} style={{ width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}><Check size={12} /></button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wait Queue */}
        <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>Fila de Espera</span>
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{waitAppts.length}</span>
            </div>
            {waitAppts.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Nenhum paciente na espera</div>
            ) : (
              waitAppts.map(a => {
                const p = store.getPaciente(a.pacienteId);
                return (
                  <div key={a.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--gray-50)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>{p?.nome}</span>
                      <button onClick={() => onUpdate({ ...a, status: 'confirmado' })} style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--mint)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="var(--primary)" /></button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 6 }}>{p?.telefone}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--gray-600)' }}>HORÁRIO: <strong>{a.hora}</strong></span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, ...TIPO_BADGE[a.tipo] }}>{a.tipo}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openModal(a)} style={{ flex: 1, padding: '6px', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-700)' }}>Editar</button>
                      <button onClick={() => setConfirmDelete(a.id)} style={{ flex: 1, padding: '6px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--red-500)' }}>Excluir</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Floating add button */}
          <button onClick={() => openModal()} style={{ position: 'fixed', bottom: 32, right: 32, width: 48, height: 48, borderRadius: '50%', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(58,170,53,0.4)' }}>
            <Plus size={22} />
          </button>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 480, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{modal.mode === 'add' ? 'Novo Agendamento' : 'Editar Agendamento'}</h2>
              <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Paciente *</label>
                <select value={modal.data.pacienteId || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, pacienteId: e.target.value } }))} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.pacienteId ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                  <option value="">Selecione o paciente...</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                {errors.pacienteId && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.pacienteId}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Data *</label>
                  <input type="date" value={modal.data.data || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, data: e.target.value } }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Horário *</label>
                  <select value={modal.data.hora || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, hora: e.target.value } }))} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.hora ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                    <option value="">--:--</option>
                    {HOURS.map(h => <option key={h}>{h}</option>)}
                  </select>
                  {errors.hora && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.hora}</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Tipo de Consulta</label>
                  <select value={modal.data.tipo || 'Primeira Consulta'} onChange={e => setModal(m => ({ ...m, data: { ...m.data, tipo: e.target.value as TipoConsulta } }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Status</label>
                  <select value={modal.data.status || 'confirmado'} onChange={e => setModal(m => ({ ...m, data: { ...m.data, status: e.target.value as StatusAgendamento } }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                    {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Observações</label>
                <textarea value={modal.data.observacoes || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, observacoes: e.target.value } }))} placeholder="Anotações sobre o agendamento..." rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={closeModal} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-700)' }}>Cancelar</button>
                <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} /> Salvar Agendamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '90%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>Confirmar exclusão</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>Deseja excluir este agendamento?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }} style={{ padding: '9px 18px', background: 'var(--red-500)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}