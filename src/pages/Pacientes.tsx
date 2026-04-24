import React, { useState, useRef } from 'react';
import { Search, Plus, Eye, Pencil, Trash2, X, Camera, User, Lock } from 'lucide-react';
import type { Paciente, ConvenioType, StatusPaciente } from '../types';

interface PacientesProps {
  pacientes: Paciente[];
  onAdd: (p: Omit<Paciente, 'id'>) => void;
  onUpdate: (p: Paciente) => void;
  onDelete: (id: string) => void;
  highlightId?: string;
  initialOpen?: boolean;
  readOnly?: boolean; // true = perfil Secretaria (sem prontuário completo)
}

const CONVENIOS: ConvenioType[] = ['Particular', 'Unimed Nacional', 'Bradesco Saúde', 'Amil S450', 'SulAmérica', 'Porto Seguro', 'Notre Dame'];

function initials(nome: string) {
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatDateBR(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const emptyForm: Omit<Paciente, 'id'> = {
  nome: '', cpf: '', dataNasc: '', email: '', telefone: '',
  convenio: 'Particular', status: 'Ativo', etnia: '', raca: '', foto: '',
  nomeSocial: '', observacoes: '',
};

export default function Pacientes({ pacientes, onAdd, onUpdate, onDelete, highlightId, initialOpen, readOnly = false }: PacientesProps) {
  const [search, setSearch] = useState('');
  const [filterConvenio, setFilterConvenio] = useState('');
  const [filterStatus, setFilterStatus] = useState('Ativos e Inativos');
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit' | 'view'; data: Partial<Paciente> }>({ open: false, mode: 'add', data: {} });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialOpen) openAdd();
  }, [initialOpen]);

  const filtered = pacientes.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.nome.toLowerCase().includes(q) || p.cpf.includes(q);
    const matchConvenio = !filterConvenio || p.convenio === filterConvenio;
    const matchStatus = filterStatus === 'Ativos e Inativos' || p.status === filterStatus.replace('s', '');
    return matchSearch && matchConvenio && matchStatus;
  });

  const openAdd = () => setModal({ open: true, mode: 'add', data: { ...emptyForm } });
  const openEdit = (p: Paciente) => setModal({ open: true, mode: 'edit', data: { ...p } });
  const openView = (p: Paciente) => setModal({ open: true, mode: 'view', data: { ...p } });
  const closeModal = () => { setModal({ open: false, mode: 'add', data: {} }); setErrors({}); };

  const validate = (d: Partial<Paciente>) => {
    const e: Record<string, string> = {};
    if (!d.nome?.trim()) e.nome = 'Nome obrigatório';
    if (!d.cpf?.trim()) e.cpf = 'CPF obrigatório';
    if (!d.dataNasc) e.dataNasc = 'Data obrigatória';
    return e;
  };

  const handleSave = () => {
    const e = validate(modal.data);
    if (Object.keys(e).length) { setErrors(e); return; }
    if (modal.mode === 'add') onAdd(modal.data as Omit<Paciente, 'id'>);
    else if (modal.mode === 'edit') onUpdate(modal.data as Paciente);
    closeModal();
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setModal(m => ({ ...m, data: { ...m.data, foto: ev.target?.result as string } }));
    reader.readAsDataURL(file);
  };

  const isView = modal.mode === 'view';
  const Field = ({ label, field, type = 'text', placeholder = '', required = false, disabled = false }: {
    label: string; field: keyof Paciente; type?: string; placeholder?: string; required?: boolean; disabled?: boolean;
  }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label} {required && <span style={{ color: 'var(--red-500)' }}>*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={(modal.data[field] as string) || ''}
        onChange={e => setModal(m => ({ ...m, data: { ...m.data, [field]: e.target.value } }))}
        disabled={isView || disabled}
        style={{
          padding: '10px 12px',
          border: `1px solid ${errors[field] ? 'var(--red-500)' : 'var(--gray-200)'}`,
          borderRadius: 8, fontSize: 13, outline: 'none',
          background: isView || disabled ? 'var(--gray-50)' : 'var(--background)',
          color: 'var(--gray-800)',
        }}
      />
      {errors[field] && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors[field]}</span>}
    </div>
  );

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>
            {readOnly ? 'Cadastro de Pacientes' : 'Gestão de Pacientes'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
            {readOnly
              ? 'Cadastre e consulte dados básicos de pacientes.'
              : 'Gerencie a base de dados de seus pacientes com segurança.'}
          </p>
          {readOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 10px', background: 'var(--amber-100)', borderRadius: 20, width: 'fit-content' }}>
              <Lock size={11} color="var(--amber-600)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber-600)' }}>Acesso limitado — prontuário médico restrito</span>
            </div>
          )}
        </div>
        <button onClick={openAdd} style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> + Novo Paciente
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Busca</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por Nome ou CPF..." style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Convênio</label>
          <select value={filterConvenio} onChange={e => setFilterConvenio(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)', cursor: 'pointer' }}>
            <option value="">Todos os Convênios</option>
            {CONVENIOS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)', cursor: 'pointer' }}>
            <option>Ativos e Inativos</option>
            <option>Ativos</option>
            <option>Inativos</option>
          </select>
        </div>
        <button style={{ padding: '9px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Filtrar</button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gray-100)' }}>
              {['Paciente', 'CPF', 'Convênio', 'Data Nasc.', 'Telefone', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--gray-50)', background: highlightId === p.id ? 'var(--mint)' : undefined }}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--dark)', flexShrink: 0, overflow: 'hidden' }}>
                      {p.foto ? <img src={p.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(p.nome)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{p.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{p.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--gray-600)' }}>{p.cpf}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--gray-600)' }}>{p.convenio}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--gray-600)' }}>{formatDateBR(p.dataNasc)}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--gray-600)' }}>{p.telefone || '—'}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: p.status === 'Ativo' ? 'var(--mint)' : 'var(--gray-100)', color: p.status === 'Ativo' ? 'var(--dark)' : 'var(--gray-500)' }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openView(p)} title="Visualizar" style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}><Eye size={15} /></button>
                    <button onClick={() => openEdit(p)} title="Editar" style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-600)' }}><Pencil size={15} /></button>
                    {!readOnly && (
                      <button onClick={() => setConfirmDelete(p.id)} title="Excluir" style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-500)' }}><Trash2 size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 14 }}>
                  Nenhum paciente encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-100)' }}>
          <strong>{filtered.length}</strong> paciente{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 560, maxHeight: '90vh', overflow: 'auto', padding: 32, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-800)' }}>
                {modal.mode === 'add' ? 'Novo Paciente' : modal.mode === 'edit' ? 'Editar Paciente' : 'Dados do Paciente'}
              </h2>
              <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>

            {/* Foto */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ width: 80, height: 80, borderRadius: 16, background: 'var(--mint)', border: '2px dashed var(--light)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: modal.data.foto ? 'hidden' : 'visible', cursor: !isView ? 'pointer' : 'default' }}
                onClick={() => !isView && fileRef.current?.click()}>
                {modal.data.foto ? <img src={modal.data.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={28} color="var(--light)" />}
                {!isView && (
                  <div style={{ position: 'absolute', bottom: -8, right: -8, width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera size={12} color="#fff" />
                  </div>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 12 }}>FOTO DO PACIENTE (OPCIONAL)</p>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </div>

            {/* Seção: Dados Pessoais */}
            <SectionTitle label="Dados Pessoais" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <Field label="Nome Completo" field="nome" placeholder="Ex: Maria Oliveira da Silva" required />
              <Field label="Nome Social" field="nomeSocial" placeholder="Apelido ou nome social" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="CPF" field="cpf" placeholder="000.000.000-00" required />
                <Field label="Data de Nascimento" field="dataNasc" type="date" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Etnia</label>
                  <select value={modal.data.etnia || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, etnia: e.target.value } }))} disabled={isView} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                    <option value="">Selecione</option>
                    {['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não informada'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Raça</label>
                  <select value={modal.data.raca || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, raca: e.target.value } }))} disabled={isView} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                    <option value="">Selecione</option>
                    {['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Seção: Contato */}
            <SectionTitle label="Contato" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <Field label="Telefone/WhatsApp" field="telefone" placeholder="(00) 00000-0000" />
              <Field label="E-mail" field="email" type="email" placeholder="paciente@exemplo.com" />
            </div>

            {/* Observações — visible para todos */}
            <SectionTitle label="Observações" />
            <div style={{ marginBottom: 20 }}>
              <textarea
                value={modal.data.observacoes || ''}
                onChange={e => setModal(m => ({ ...m, data: { ...m.data, observacoes: e.target.value } }))}
                disabled={isView}
                placeholder="Alergias, restrições, notas relevantes..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)', resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }}
              />
            </div>

            {/* Informações médicas — ocultas para secretaria em modo view limitado */}
            {!readOnly && (
              <>
                <SectionTitle label="Informações Médicas" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Convênio Médico</label>
                    <select value={modal.data.convenio || 'Particular'} onChange={e => setModal(m => ({ ...m, data: { ...m.data, convenio: e.target.value as ConvenioType } }))} disabled={isView} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                      {CONVENIOS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Status</label>
                    <select value={modal.data.status || 'Ativo'} onChange={e => setModal(m => ({ ...m, data: { ...m.data, status: e.target.value as StatusPaciente } }))} disabled={isView} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }}>
                      <option>Ativo</option>
                      <option>Inativo</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Convênio para secretaria (somente visualização) */}
            {readOnly && (
              <div style={{ marginBottom: 20 }}>
                <SectionTitle label="Convênio" />
                <div style={{ padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 8, fontSize: 13, color: 'var(--gray-600)', border: '1px solid var(--gray-200)' }}>
                  {modal.data.convenio || 'Particular'}
                </div>
              </div>
            )}

            {!isView && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={closeModal} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-700)' }}>Cancelar</button>
                <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {modal.mode === 'add' ? 'Cadastrar Paciente' : 'Salvar Alterações'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '90%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>Confirmar exclusão</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.</p>
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

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ height: 1, flex: 1, background: 'var(--gray-100)' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: 'var(--gray-100)' }} />
    </div>
  );
}