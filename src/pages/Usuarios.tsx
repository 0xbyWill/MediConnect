import { useCallback, useEffect, useState } from 'react';
import { UserCog, Plus, Pencil, Trash2, X, Shield, Search, RefreshCw } from 'lucide-react';
import { doctorsApi, usersApi } from '../lib/api';
import type { ApiDoctor, ApiManagedUser, CreateUserResponse } from '../lib/api';
import type { UserRole } from '../types';

interface UsuarioItem {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  status: 'ativo' | 'inativo';
  cpf?: string;
  telefone?: string;
  senha?: string;
  crm?: string;
  crmUf?: string;
  especialidade?: string;
}

type UsuarioForm = Omit<UsuarioItem, 'id'>;

const ROLE_LABEL: Record<UserRole, string> = {
  medico:     'Médico',
  gestao:     'Gestão',
  secretaria: 'Secretaria',
  paciente:   'Paciente',
};

const ROLE_COLOR: Record<UserRole, { bg: string; color: string }> = {
  medico:     { bg: 'var(--mint)',      color: 'var(--dark)' },
  gestao:     { bg: '#ede9fe',          color: '#7c3aed' },
  secretaria: { bg: 'var(--amber-100)', color: 'var(--amber-600)' },
  paciente:   { bg: '#dbeafe',          color: '#2563eb' },
};

const ROLE_API: Record<UserRole, 'medico' | 'admin' | 'secretaria' | 'paciente'> = {
  medico:     'medico',
  gestao:     'admin',
  secretaria: 'secretaria',
  paciente:   'paciente',
};

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const emptyForm: UsuarioForm = {
  nome: '',
  email: '',
  role: 'secretaria',
  status: 'ativo',
  cpf: '',
  telefone: '',
  senha: '',
  crm: '',
  crmUf: 'SP',
  especialidade: '',
};

const digitsOnly = (value = '') => value.replace(/\D/g, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cellBaseStyle: React.CSSProperties = {
  padding: '14px 20px',
  minWidth: 0,
  overflow: 'hidden',
};
const ellipsisStyle: React.CSSProperties = {
  display: 'block',
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function formatSaveError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Erro ao salvar usuário.';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'Informe um e-mail válido. Ex: usuario@clinica.com';
  }
  if (msg.includes('400')) return 'A API recusou os dados enviados. Confira os campos obrigatórios.';
  if (msg.includes('401') || msg.includes('403')) {
    return 'Seu perfil precisa ser Gestão/Admin para criar usuários.';
  }
  return msg;
}

function responseId(response: ApiDoctor | CreateUserResponse): string {
  if ('id' in response && response.id) return response.id;
  if ('user' in response) return response.user?.id ?? Date.now().toString();
  return Date.now().toString();
}

function normalizeUserRole(role?: string): UserRole {
  const r = role?.toLowerCase().trim();
  if (r === 'medico' || r === 'doctor' || r === 'physician') return 'medico';
  if (r === 'secretaria' || r === 'secretary' || r === 'receptionist') return 'secretaria';
  if (r === 'paciente' || r === 'patient') return 'paciente';
  return 'gestao';
}

function doctorToUsuario(doctor: ApiDoctor): UsuarioItem {
  return {
    id: doctor.id,
    nome: doctor.full_name,
    email: doctor.email ?? '',
    role: 'medico',
    status: doctor.active === false ? 'inativo' : 'ativo',
    cpf: doctor.cpf,
    telefone: doctor.phone_mobile,
    crm: doctor.crm,
    crmUf: doctor.crm_uf,
    especialidade: doctor.specialty,
  };
}

function managedUserToUsuario(user: ApiManagedUser): UsuarioItem {
  return {
    id: user.id,
    nome: user.full_name,
    email: user.email,
    role: normalizeUserRole(user.role),
    status: user.active === false ? 'inativo' : 'ativo',
    cpf: user.cpf,
    telefone: user.phone,
  };
}

function mergeUsuarios(items: UsuarioItem[]) {
  return Array.from(
    new Map(items.map(item => [`${item.role}:${item.email || item.id}`, item])).values()
  );
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: UsuarioForm & { id?: string } }>({ open: false, mode: 'add', data: emptyForm });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [search, setSearch] = useState('');

  const loadUsuarios = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const [doctors, managedUsers] = await Promise.all([
        doctorsApi.list().catch(() => [] as ApiDoctor[]),
        usersApi.list().catch(() => [] as ApiManagedUser[]),
      ]);
      setUsuarios(mergeUsuarios([
        ...doctors.map(doctorToUsuario),
        ...managedUsers.map(managedUserToUsuario),
      ]));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar usuários.';
      setFormError(msg);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void loadUsuarios();
    const intervalId = window.setInterval(() => { void loadUsuarios(); }, 30000);
    return () => window.clearInterval(intervalId);
  }, [loadUsuarios]);

  const openAdd = () => {
    setFormError(null);
    setSuccessMessage(null);
    setModal({ open: true, mode: 'add', data: { ...emptyForm } });
  };

  const openEdit = (u: UsuarioItem) => {
    setFormError(null);
    setSuccessMessage(null);
    setModal({ open: true, mode: 'edit', data: { ...emptyForm, ...u } });
  };

  const resetModal = () => {
    setModal({ open: false, mode: 'add', data: emptyForm });
    setFormError(null);
  };

  const closeModal = () => {
    if (saving) return;
    resetModal();
  };

  const set = (field: keyof UsuarioForm, value: string) =>
    setModal(m => ({ ...m, data: { ...m.data, [field]: value } }));

  const validateForm = () => {
    const d = modal.data;
    if (!d.nome.trim()) return 'Informe o nome completo.';
    if (!d.email.trim()) return 'Informe o e-mail.';
    if (!EMAIL_RE.test(d.email.trim())) return 'Informe um e-mail válido. Ex: usuario@clinica.com';
    if (!d.telefone?.trim()) return 'Informe o telefone.';
    if (modal.mode === 'add' && !d.senha?.trim()) return 'Informe a senha inicial.';
    if (d.senha && d.senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
    if (d.role === 'secretaria' && digitsOnly(d.cpf).length !== 11) {
      return 'Informe o CPF da secretária com 11 dígitos.';
    }
    if (d.role === 'medico') {
      if (digitsOnly(d.cpf).length !== 11) return 'Informe um CPF válido com 11 dígitos.';
      if (!d.crm?.trim()) return 'Informe o CRM.';
      if (!d.crmUf?.trim()) return 'Informe a UF do CRM.';
      if (!d.especialidade?.trim()) return 'Informe a especialidade.';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const data = modal.data;
    setSaving(true);
    setFormError(null);

    try {
      if (modal.mode === 'edit') {
        setUsuarios(prev => prev.map(u => u.id === data.id ? { ...u, ...data, id: u.id } : u));
        setSuccessMessage('Usuário atualizado na tela.');
        resetModal();
        return;
      }

      if (data.role === 'medico') {
        const payload = {
          email: data.email.trim().toLowerCase(),
          password: data.senha?.trim() ?? '',
          full_name: data.nome.trim(),
          phone: data.telefone?.trim(),
          role: ROLE_API[data.role],
          cpf: digitsOnly(data.cpf),
          crm: data.crm?.trim() ?? '',
          crm_uf: data.crmUf?.trim().toUpperCase() ?? '',
          specialty: data.especialidade?.trim() ?? '',
          phone_mobile: data.telefone?.trim() ?? '',
        };

        const response = await usersApi.createWithPassword(payload);
        const doctor = 'full_name' in response ? response as ApiDoctor : null;
        const novo: UsuarioItem = {
          id: responseId(response),
          nome: doctor?.full_name ?? payload.full_name,
          email: doctor?.email ?? payload.email,
          role: 'medico',
          status: 'ativo',
          cpf: doctor?.cpf ?? payload.cpf,
          telefone: doctor?.phone_mobile ?? payload.phone_mobile,
          crm: doctor?.crm ?? payload.crm,
          crmUf: doctor?.crm_uf ?? payload.crm_uf,
          especialidade: doctor?.specialty ?? payload.specialty,
        };

        setUsuarios(prev => [...prev, novo]);
        setSuccessMessage('Médico criado com sucesso.');
        await loadUsuarios();
      } else {
        const payload = {
          email: data.email.trim().toLowerCase(),
          full_name: data.nome.trim(),
          phone: data.telefone?.trim(),
          phone_mobile: data.telefone?.trim(),
          role: ROLE_API[data.role],
          ...(data.cpf?.trim() ? { cpf: digitsOnly(data.cpf) } : {}),
        };

        const response = data.senha
          ? await usersApi.createWithPassword({ ...payload, password: data.senha.trim() })
          : await usersApi.create(payload);
        const novo: UsuarioItem = {
          id: responseId(response),
          nome: response.user?.full_name ?? payload.full_name,
          email: response.user?.email ?? payload.email,
          role: data.role,
          status: 'ativo',
          cpf: data.cpf ? digitsOnly(data.cpf) : undefined,
          telefone: payload.phone,
        };

        setUsuarios(prev => [...prev, novo]);
        setSuccessMessage(response.message ?? 'Usuário criado com sucesso.');
        await loadUsuarios();
      }

      resetModal();
    } catch (err) {
      setFormError(formatSaveError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setFormError(null);
    try {
      const response = await usersApi.deletePermanent(id);
      setSuccessMessage(response.message ?? 'Usuario deletado permanentemente.');
      setConfirmDelete(null);
      await loadUsuarios();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao deletar usuario.');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsuarios = usuarios.filter(u => {
    const q = search.toLowerCase().trim();
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchSearch = !q
      || u.nome.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || (u.cpf || '').includes(q)
      || (u.crm || '').toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Gestão de Usuários</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>Gerencie os perfis de acesso ao sistema.</p>
          {successMessage && <p style={{ fontSize: 12, color: 'var(--primary)', marginTop: 8 }}>{successMessage}</p>}
        </div>
        <button onClick={openAdd} style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {(['medico', 'gestao', 'secretaria', 'paciente'] as UserRole[]).map(role => {
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Filtro de perfil
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
            {loadingUsers ? 'Atualizando dados da API...' : `${filteredUsuarios.length} usuário${filteredUsuarios.length === 1 ? '' : 's'} exibido${filteredUsuarios.length === 1 ? '' : 's'}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, e-mail, CPF ou CRM..."
              style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff', color: 'var(--gray-700)' }}
            />
          </div>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as UserRole | '')}
          style={{ minWidth: 220, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff', color: 'var(--gray-700)', cursor: 'pointer' }}
        >
          <option value="">Todos os perfis</option>
          <option value="medico">Médico</option>
          <option value="gestao">Gestão</option>
          <option value="secretaria">Secretaria</option>
          <option value="paciente">Paciente</option>
        </select>

        <button
          onClick={() => { void loadUsuarios(); }}
          disabled={loadingUsers}
          style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--gray-200)', background: loadingUsers ? 'var(--gray-50)' : '#fff', color: loadingUsers ? 'var(--gray-400)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loadingUsers ? 'default' : 'pointer' }}
          title="Atualizar usuários"
        >
          <RefreshCw size={15} style={{ animation: loadingUsers ? 'spin 1s linear infinite' : undefined }} />
        </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', overflow: 'auto', maxWidth: '100%' }}>
        <table style={{ width: '100%', minWidth: 860, maxWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <colgroup>
            <col style={{ width: '28%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gray-100)' }}>
              {['Usuário', 'E-mail', 'Perfil', 'CPF/CRM', 'Telefone', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsuarios.map(u => {
              const rs = ROLE_COLOR[u.role];
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                  <td style={cellBaseStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--dark)', flexShrink: 0 }}>
                        {u.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div title={u.nome} style={{ ...ellipsisStyle, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{u.nome}</div>
                        {u.especialidade && <div title={u.especialidade} style={{ ...ellipsisStyle, fontSize: 11, color: 'var(--gray-400)' }}>{u.especialidade}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...cellBaseStyle, fontSize: 13, color: 'var(--gray-600)' }}>
                    <span title={u.email} style={ellipsisStyle}>{u.email}</span>
                  </td>
                  <td style={cellBaseStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <Shield size={13} color={rs.color} />
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: rs.bg, color: rs.color }}>{ROLE_LABEL[u.role]}</span>
                    </div>
                  </td>
                  <td style={{ ...cellBaseStyle, fontSize: 13, color: 'var(--gray-500)' }}>
                    {(() => {
                      const documentText = u.role === 'medico' ? `${u.crm || '-'}${u.crmUf ? `/${u.crmUf}` : ''}` : u.cpf || '—';
                      return <span title={documentText} style={ellipsisStyle}>{documentText}</span>;
                    })()}
                  </td>
                  <td style={{ ...cellBaseStyle, fontSize: 13, color: 'var(--gray-500)' }}>
                    <span title={u.telefone || '—'} style={ellipsisStyle}>{u.telefone || '—'}</span>
                  </td>
                  <td style={cellBaseStyle}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: u.status === 'ativo' ? 'var(--mint)' : 'var(--gray-100)', color: u.status === 'ativo' ? 'var(--dark)' : 'var(--gray-400)' }}>
                      {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={cellBaseStyle}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => openEdit(u)} style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-600)' }}><Pencil size={14} /></button>
                      <button onClick={() => setConfirmDelete(u.id)} style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-500)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredUsuarios.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <Search size={28} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-600)' }}>Nenhum usuário encontrado</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Tente ajustar o nome pesquisado ou o filtro de perfil.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 'min(620px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '28px 32px 18px', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCog size={16} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-800)' }}>
                  {modal.mode === 'add' ? 'Novo Usuário' : 'Editar Usuário'}
                </h2>
              </div>
              <button onClick={closeModal} disabled={saving} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-100)', border: 'none', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 32px', overflow: 'auto', minHeight: 0 }}>
              <FormInput label="Nome completo" value={modal.data.nome} onChange={value => set('nome', value)} placeholder="Ex: Dr. João Silva" />
              <FormInput label="E-mail" value={modal.data.email} onChange={value => set('email', value)} placeholder="usuario@clinica.com" type="email" />
              <FormInput label="Telefone" value={modal.data.telefone || ''} onChange={value => set('telefone', value)} placeholder="(11) 99999-9999" />

              <div>
                <label style={labelStyle}>Perfil de acesso</label>
                <select value={modal.data.role} onChange={e => set('role', e.target.value)} style={fieldStyle}>
                  <option value="medico">Médico</option>
                  <option value="gestao">Gestão / Coordenação</option>
                  <option value="secretaria">Secretaria</option>
                  <option value="paciente">Paciente</option>
                </select>
              </div>

              {modal.data.role === 'secretaria' && (
                <FormInput label="CPF" value={modal.data.cpf || ''} onChange={value => set('cpf', value)} placeholder="12345678901" />
              )}

              {modal.data.role === 'medico' && (
                <>
                  <FormInput label="CPF" value={modal.data.cpf || ''} onChange={value => set('cpf', value)} placeholder="12345678901" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(96px, 120px)', gap: 12 }}>
                    <FormInput label="CRM" value={modal.data.crm || ''} onChange={value => set('crm', value)} placeholder="123456" />
                    <div>
                      <label style={labelStyle}>UF do CRM</label>
                      <select value={modal.data.crmUf || 'SP'} onChange={e => set('crmUf', e.target.value)} style={fieldStyle}>
                        {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                  </div>
                  <FormInput label="Especialidade" value={modal.data.especialidade || ''} onChange={value => set('especialidade', value)} placeholder="Ex: Cardiologia" />
                </>
              )}

              {modal.mode === 'add' && (
                <FormInput label="Senha inicial" value={modal.data.senha || ''} onChange={value => set('senha', value)} placeholder="Mínimo 6 caracteres" type="password" />
              )}

              {modal.mode === 'edit' && (
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={modal.data.status} onChange={e => set('status', e.target.value)} style={fieldStyle}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              )}
            </div>

            {formError && (
              <div style={{ margin: '0 32px 12px', padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: 'var(--red-500)', fontSize: 12, fontWeight: 600 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '16px 32px 28px', borderTop: '1px solid var(--gray-100)', flexWrap: 'wrap' }}>
              <button onClick={closeModal} disabled={saving} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', color: 'var(--gray-700)' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: saving ? 'var(--gray-400)' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Salvando...' : modal.mode === 'add' ? 'Criar Usuário' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '90%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>Confirmar exclusão</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button disabled={saving} onClick={() => setConfirmDelete(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>Cancelar</button>
              <button disabled={saving} onClick={() => void handleDelete(confirmDelete)} style={{ padding: '9px 18px', background: 'var(--red-500)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
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

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid var(--gray-200)',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  background: 'var(--gray-50)',
};

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={fieldStyle}
      />
    </div>
  );
}
