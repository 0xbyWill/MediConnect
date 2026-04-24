import { useState } from 'react';
import { UserCog, Plus, Pencil, Trash2, X, Shield, Eye, EyeOff } from 'lucide-react';
import type { UserRole } from '../types';

interface UsuarioItem {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: 'ativo' | 'inativo';
  crm?: string;
  especialidade?: string;
}

const ROLE_LABEL: Record<UserRole, string> = {
  medico:     'Médico',
  gestao:     'Gestão',
  secretaria: 'Secretaria',
};

const ROLE_COLOR: Record<UserRole, { bg: string; color: string }> = {
  medico:     { bg: 'var(--mint)',     color: 'var(--dark)' },
  gestao:     { bg: '#ede9fe',         color: '#7c3aed' },
  secretaria: { bg: 'var(--amber-100)', color: 'var(--amber-600)' },
};

const mockUsuarios: UsuarioItem[] = [
  { id: 'u1', nome: 'Dr. User Profile', email: 'medico@mediconnect.com', role: 'medico', status: 'ativo', crm: 'CRM/SP 123456', especialidade: 'Cardiologista' },
  { id: 'u2', nome: 'Coordenadora Ana', email: 'gestao@mediconnect.com', role: 'gestao', status: 'ativo' },
  { id: 'u3', nome: 'Secretária Maria', email: 'secretaria@mediconnect.com', role: 'secretaria', status: 'ativo' },
];

const emptyForm: Omit<UsuarioItem, 'id'> & { senha: string } = {
  nome: '', email: '', role: 'secretaria', status: 'ativo', crm: '', especialidade: '', senha: '',
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>(mockUsuarios);
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: typeof emptyForm & { id?: string } }>({ open: false, mode: 'add', data: emptyForm });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const openAdd = () => setModal({ open: true, mode: 'add', data: { ...emptyForm } });
  const openEdit = (u: UsuarioItem) => setModal({ open: true, mode: 'edit', data: { ...emptyForm, ...u } });
  const closeModal = () => setModal({ open: false, mode: 'add', data: emptyForm });

  const handleSave = () => {
    if (modal.mode === 'add') {
      const novo: UsuarioItem = { ...modal.data, id: Date.now().toString() };
      setUsuarios(prev => [...prev, novo]);
    } else {
      setUsuarios(prev => prev.map(u => u.id === modal.data.id ? { ...u, ...modal.data, id: u.id } : u));
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    setUsuarios(prev => prev.filter(u => u.id !== id));
    setConfirmDelete(null);
  };

  const set = (field: string, value: string) =>
    setModal(m => ({ ...m, data: { ...m.data, [field]: value } }));

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Gestão de Usuários</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>Gerencie os perfis de acesso ao sistema.</p>
        </div>
        <button onClick={openAdd} style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      {/* Cards de perfil */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {(['medico', 'gestao', 'secretaria'] as UserRole[]).map(role => {
          const count = usuarios.filter(u => u.role === role).length;
          const st = ROLE_COLOR[role];
          return (
            <div key={role} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{ROLE_LABEL[role]}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--dark)' }}>{count}</div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color }}>usuário{count !== 1 ? 's' : ''}</span>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gray-100)' }}>
              {['Usuário', 'E-mail', 'Perfil', 'Especialidade', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const rs = ROLE_COLOR[u.role];
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--dark)', flexShrink: 0 }}>
                        {u.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{u.nome}</div>
                        {u.crm && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{u.crm}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--gray-600)' }}>{u.email}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Shield size={13} color={rs.color} />
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: rs.bg, color: rs.color }}>{ROLE_LABEL[u.role]}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--gray-500)' }}>{u.especialidade || '—'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: u.status === 'ativo' ? 'var(--mint)' : 'var(--gray-100)', color: u.status === 'ativo' ? 'var(--dark)' : 'var(--gray-400)' }}>
                      {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(u)} style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-600)' }}><Pencil size={14} /></button>
                      <button onClick={() => setConfirmDelete(u.id)} style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-500)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 480, maxHeight: '90vh', overflow: 'auto', padding: 32, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCog size={16} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-800)' }}>
                  {modal.mode === 'add' ? 'Novo Usuário' : 'Editar Usuário'}
                </h2>
              </div>
              <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[{ label: 'Nome Completo', field: 'nome', placeholder: 'Ex: Dr. João Silva' },
                { label: 'E-mail', field: 'email', placeholder: 'usuario@clinica.com' },
              ].map(f => (
                <div key={f.field}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input
                    value={(modal.data as Record<string, string>)[f.field] || ''}
                    onChange={e => set(f.field, e.target.value)}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }}
                  />
                </div>
              ))}

              {/* Senha */}
              {modal.mode === 'add' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={modal.data.senha}
                      onChange={e => set('senha', e.target.value)}
                      placeholder="••••••••"
                      style={{ width: '100%', padding: '10px 36px 10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Perfil */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Perfil de Acesso</label>
                <select value={modal.data.role} onChange={e => set('role', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}>
                  <option value="medico">Médico</option>
                  <option value="gestao">Gestão / Coordenação</option>
                  <option value="secretaria">Secretaria</option>
                </select>
              </div>

              {modal.data.role === 'medico' && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>CRM</label>
                    <input value={modal.data.crm || ''} onChange={e => set('crm', e.target.value)} placeholder="CRM/SP 000000" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Especialidade</label>
                    <input value={modal.data.especialidade || ''} onChange={e => set('especialidade', e.target.value)} placeholder="Ex: Cardiologista" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }} />
                  </div>
                </>
              )}

              {/* Status */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Status</label>
                <select value={modal.data.status} onChange={e => set('status', e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={closeModal} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-700)' }}>Cancelar</button>
              <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {modal.mode === 'add' ? 'Criar Usuário' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '90%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>Confirmar exclusão</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '9px 18px', background: 'var(--red-500)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}