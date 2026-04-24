import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, X, Check } from 'lucide-react';
import type { Laudo, Paciente, StatusLaudo } from "../types";
import { store } from '../store';

interface LaudosProps {
  laudos: Laudo[];
  pacientes: Paciente[];
  onAdd: (l: Omit<Laudo, 'id'>) => void;
  onUpdate: (l: Laudo) => void;
  onDelete: (id: string) => void;
}

function initials(nome: string) {
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatDateBR(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const today = new Date().toISOString().split('T')[0];

const emptyForm: Omit<Laudo, 'id'> = {
  pacienteId: '', cid: '', data: today, diagnostico: '', tecnica: '', impressao: '', status: 'rascunho'
};

export default function Laudos({ laudos, pacientes, onAdd, onUpdate, onDelete }: LaudosProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: Partial<Laudo> }>({ open: false, mode: 'add', data: {} });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sorted = [...laudos].sort((a, b) => b.data.localeCompare(a.data));
  const filtered = sorted.filter(l => {
    const p = store.getPaciente(l.pacienteId);
    const q = search.toLowerCase();
    const matchSearch = !q || p?.nome.toLowerCase().includes(q) || l.cid.toLowerCase().includes(q);
    const matchStatus = !filterStatus || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openAdd = () => { setModal({ open: true, mode: 'add', data: { ...emptyForm } }); setErrors({}); };
  const openEdit = (l: Laudo) => { setModal({ open: true, mode: 'edit', data: { ...l } }); setErrors({}); };
  const closeModal = () => { setModal({ open: false, mode: 'add', data: {} }); setErrors({}); };

  const validate = (d: Partial<Laudo>) => {
    const e: Record<string, string> = {};
    if (!d.pacienteId) e.pacienteId = 'Selecione um paciente';
    if (!d.diagnostico?.trim()) e.diagnostico = 'Diagnóstico obrigatório';
    return e;
  };

  const handleSave = () => {
    const e = validate(modal.data);
    if (Object.keys(e).length) { setErrors(e); return; }
    if (modal.mode === 'add') onAdd(modal.data as Omit<Laudo, 'id'>);
    else onUpdate(modal.data as Laudo);
    closeModal();
  };

  const liberarLaudo = (l: Laudo) => onUpdate({ ...l, status: 'liberado' });

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Laudos Médicos</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>Gerencie e emita laudos com facilidade</p>
        </div>
        <button onClick={openAdd} style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> + Novo Laudo
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', display: 'flex', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Buscar</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Paciente ou CID..." style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)', cursor: 'pointer' }}>
            <option value="">Todos</option>
            <option value="rascunho">Rascunho</option>
            <option value="liberado">Liberado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', overflow: 'hidden' }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gray-100)' }}>
              {['Paciente', 'CID', 'Data do Exame', 'Diagnóstico', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const p = store.getPaciente(l.pacienteId);
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--dark)', flexShrink: 0, overflow: 'hidden' }}>
                        {p?.foto ? <img src={p.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(p?.nome || '??')}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{p?.nome || 'Paciente removido'}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{p?.convenio}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <code style={{ background: 'var(--background)', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}>{l.cid || '—'}</code>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--gray-500)' }}>{formatDateBR(l.data)}</td>
                  <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--gray-600)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.diagnostico}>
                    {l.diagnostico}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: l.status === 'liberado' ? '#e0e7ff' : 'var(--gray-100)', color: l.status === 'liberado' ? '#4f46e5' : 'var(--gray-500)' }}>
                      {l.status === 'liberado' ? 'Liberado' : 'Rascunho'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(l)} title="Editar" style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-600)' }}><Pencil size={15} /></button>
                      {l.status === 'rascunho' && (
                        <button onClick={() => liberarLaudo(l)} title="Liberar" style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}><Check size={15} /></button>
                      )}
                      <button onClick={() => setConfirmDelete(l.id)} title="Excluir" style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-500)' }}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-100)' }}>
          <strong>{filtered.length}</strong> laudo{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 520, maxHeight: '90vh', overflow: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{modal.mode === 'add' ? 'Novo Laudo' : 'Editar Laudo'}</h2>
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
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>CID</label>
                  <input value={modal.data.cid || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, cid: e.target.value } }))} placeholder="Ex: M54.5" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Data do Exame *</label>
                  <input type="date" value={modal.data.data || today} onChange={e => setModal(m => ({ ...m, data: { ...m.data, data: e.target.value } }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Diagnóstico / Indicação Clínica *</label>
                <textarea value={modal.data.diagnostico || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, diagnostico: e.target.value } }))} placeholder="Descreva o diagnóstico..." rows={3} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.diagnostico ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)', resize: 'vertical' }} />
                {errors.diagnostico && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.diagnostico}</span>}
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Técnica</label>
                <textarea value={modal.data.tecnica || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, tecnica: e.target.value } }))} placeholder="Técnica utilizada..." rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)', resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Impressão Diagnóstica</label>
                <textarea value={modal.data.impressao || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, impressao: e.target.value } }))} placeholder="Conclusão do laudo..." rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)', resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Status</label>
                <select value={modal.data.status || 'rascunho'} onChange={e => setModal(m => ({ ...m, data: { ...m.data, status: e.target.value as StatusLaudo } }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                  <option value="rascunho">Rascunho</option>
                  <option value="liberado">Liberado</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={closeModal} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-700)' }}>Cancelar</button>
                <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} /> Salvar Laudo
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
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Confirmar exclusão</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>Deseja excluir este laudo?</p>
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