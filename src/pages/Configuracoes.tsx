import type { ElementType, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Bell, Database, Lock, MapPin, Palette, Save, ShieldCheck, UserCog } from 'lucide-react';
import { appEnv } from '../config/env';
import { useAuth } from '../contexts/AuthContext';
import type { Paciente } from '../types';
import { digitsOnly, formatCpf, isValidCpf } from '../shared/utils/cpf';
import {
  formatCep,
  formatPhoneBR,
  isValidCep,
  isValidEmail,
  isValidPhoneBR,
  normalizeEmail,
} from '../shared/utils/validation';
import { toUserFacingErrorMessage } from '../shared/utils/errors';

interface ConfiguracoesProps {
  pacientes?: Paciente[];
  onUpdatePaciente?: (paciente: Paciente) => Promise<void>;
}

export default function Configuracoes({ pacientes = [], onUpdatePaciente }: ConfiguracoesProps) {
  const { user } = useAuth();

  if (user?.role === 'paciente') {
    return <PatientSettings pacientes={pacientes} onUpdatePaciente={onUpdatePaciente} />;
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(16px, 3vw, 32px)' }}>
      <div style={{ maxWidth: 1040 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)', marginBottom: 8 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>Preferências organizadas por categoria. Dados sensíveis seguem autenticação e permissões por perfil.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          <Section title="Perfil" icon={UserCog}>
            <Info label="Nome" value={user?.full_name || '—'} />
            <Info label="E-mail" value={user?.email || '—'} />
            <Info label="Perfil" value={user?.role || '—'} />
            <Info label="Especialidade" value={user?.specialty || '—'} />
            <Info label="CRM" value={user?.crm || '—'} />
          </Section>

          <Section title="Conta" icon={Lock}>
            <Info label="Sessão" value="JWT Bearer ativo" />
            <Info label="Identificador" value={user?.id || '—'} />
            <Info label="Perfil médico" value={user?.doctor_id || 'Não vinculado'} />
          </Section>

          <Section title="Preferências" icon={Palette}>
            <Info label="Tema visual" value="Padrão MediConnect" />
            <Info label="Idioma" value="Português (Brasil)" />
            <Info label="Atualização de dados" value="Automática a cada 30s" />
          </Section>

          <Section title="Notificações" icon={Bell}>
            <Info label="Eventos" value="Consultas, laudos e erros operacionais" />
            <Info label="Leitura" value="Marcável no sino superior" />
            <Info label="Persistência" value="Local até existir tabela de notificações" />
          </Section>

          <Section title="Segurança e permissões" icon={ShieldCheck}>
            <Info label="Controle de telas" value="Por perfil do usuário" />
            <Info label="Proteção real" value="RLS / Edge Functions no Supabase" />
            <Info label="Perfis" value="Médico, Gestão e Secretaria" />
          </Section>

          <Section title="Integração do sistema" icon={Database}>
            <Info label="Backend" value="Supabase / RiseUP" />
            <Info label="Base URL" value={appEnv.supabaseUrl} />
            <Info label="Persistência" value="REST e Edge Functions" />
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─── Tela de configurações do paciente (edição dos próprios dados) ────────────
const SEXO_OPTIONS = ['Masculino', 'Feminino', 'Outro', 'Não informar'];

interface PatientFormState {
  nome: string;
  cpf: string;
  dataNasc: string;
  sexo: string;
  email: string;
  telefone: string;
  telefone2: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia: string;
}

function patientToForm(paciente: Paciente): PatientFormState {
  return {
    nome: paciente.nome ?? '',
    cpf: paciente.cpf ?? '',
    dataNasc: paciente.dataNasc ?? '',
    sexo: paciente.sexo ?? '',
    email: paciente.email ?? '',
    telefone: paciente.telefone ?? '',
    telefone2: paciente.telefone2 ?? '',
    cep: paciente.cep ?? '',
    logradouro: paciente.logradouro ?? '',
    numero: paciente.numero ?? '',
    complemento: paciente.complemento ?? '',
    bairro: paciente.bairro ?? '',
    cidade: paciente.cidade ?? '',
    estado: paciente.estado ?? '',
    referencia: paciente.referencia ?? '',
  };
}

function PatientSettings({ pacientes, onUpdatePaciente }: ConfiguracoesProps) {
  const { user } = useAuth();
  const ownPatient = useMemo(() => {
    if (!pacientes || pacientes.length === 0) return undefined;
    const byId = user?.patient_id ? pacientes.find(p => p.id === user.patient_id) : undefined;
    if (byId) return byId;
    const email = user?.email ? normalizeEmail(user.email) : '';
    const byEmail = email ? pacientes.find(p => normalizeEmail(p.email) === email) : undefined;
    return byEmail ?? pacientes[0];
  }, [pacientes, user?.email, user?.patient_id]);

  const [form, setForm] = useState<PatientFormState | null>(() => (ownPatient ? patientToForm(ownPatient) : null));
  const [loadedId, setLoadedId] = useState<string | undefined>(ownPatient?.id);
  const [errors, setErrors] = useState<Partial<Record<keyof PatientFormState, string>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sincroniza o formulário quando o registro do paciente carrega/atualiza,
  // sem sobrescrever uma edição em andamento do próprio usuário.
  if (ownPatient && ownPatient.id !== loadedId && !saving) {
    setForm(patientToForm(ownPatient));
    setLoadedId(ownPatient.id);
    setErrors({});
    setGlobalError(null);
    setSuccess(false);
  }

  const setField = (field: keyof PatientFormState, value: string) => {
    setForm(prev => (prev ? { ...prev, [field]: value } : prev));
    setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setSuccess(false);
  };

  const validate = (data: PatientFormState): Partial<Record<keyof PatientFormState, string>> => {
    const next: Partial<Record<keyof PatientFormState, string>> = {};
    if (!data.nome.trim()) next.nome = 'Informe seu nome completo.';
    if (!data.cpf.trim() || !isValidCpf(data.cpf)) next.cpf = 'Informe um CPF válido.';
    if (!data.email.trim() || !isValidEmail(data.email)) next.email = 'Informe um e-mail válido.';
    if (!data.telefone.trim() || !isValidPhoneBR(data.telefone)) next.telefone = 'Informe um telefone válido com DDD.';
    if (data.telefone2.trim() && !isValidPhoneBR(data.telefone2)) next.telefone2 = 'Informe um telefone válido com DDD.';
    if (data.cep.trim() && !isValidCep(data.cep)) next.cep = 'Informe um CEP válido (8 dígitos).';
    if (data.estado.trim() && data.estado.trim().length !== 2) next.estado = 'Use a sigla do estado (2 letras).';
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || !ownPatient) return;
    setGlobalError(null);
    setSuccess(false);

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setGlobalError('Revise os campos destacados antes de salvar.');
      return;
    }

    if (!onUpdatePaciente) {
      setGlobalError('A atualização de dados não está disponível no momento.');
      return;
    }

    const updated: Paciente = {
      ...ownPatient,
      nome: form.nome.trim(),
      cpf: digitsOnly(form.cpf),
      dataNasc: form.dataNasc,
      sexo: form.sexo || undefined,
      email: normalizeEmail(form.email),
      telefone: form.telefone,
      telefone2: form.telefone2.trim() || undefined,
      cep: form.cep.trim() || undefined,
      logradouro: form.logradouro.trim() || undefined,
      numero: form.numero.trim() || undefined,
      complemento: form.complemento.trim() || undefined,
      bairro: form.bairro.trim() || undefined,
      cidade: form.cidade.trim() || undefined,
      estado: form.estado.trim().toUpperCase() || undefined,
      referencia: form.referencia.trim() || undefined,
    };

    setSaving(true);
    try {
      await onUpdatePaciente(updated);
      setSuccess(true);
    } catch (err) {
      setGlobalError(toUserFacingErrorMessage(err, 'Não foi possível salvar suas alterações. Tente novamente em instantes.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(16px, 3vw, 32px)' }}>
      <div style={{ maxWidth: 880 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)', marginBottom: 8 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>
          Mantenha seus dados pessoais, contato e endereço sempre atualizados. As alterações são salvas no seu cadastro.
        </p>

        {!ownPatient ? (
          <div role="alert" style={{ background: '#fff', borderRadius: 14, padding: 22, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', color: 'var(--gray-600)', fontSize: 14 }}>
            Seu perfil ainda não está vinculado a um cadastro de paciente. Fale com a secretaria para concluir o vínculo e poder editar seus dados.
          </div>
        ) : form ? (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {globalError && (
              <div role="alert" style={{ background: '#fef2f2', border: '1px solid var(--red-100)', color: 'var(--red-600)', borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>
                {globalError}
              </div>
            )}
            {success && (
              <div role="status" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>
                Dados atualizados com sucesso.
              </div>
            )}

            <FormSection title="Dados pessoais" icon={UserCog}>
              <Field label="Nome completo" htmlFor="cfg-nome" error={errors.nome}>
                <input id="cfg-nome" name="name" type="text" autoComplete="name" value={form.nome}
                  onChange={e => setField('nome', e.target.value)} disabled={saving}
                  style={inputStyle(Boolean(errors.nome))} aria-invalid={Boolean(errors.nome)} />
              </Field>
              <Field label="CPF" htmlFor="cfg-cpf" error={errors.cpf}>
                <input id="cfg-cpf" name="cpf" type="text" inputMode="numeric" value={formatCpf(form.cpf)}
                  onChange={e => setField('cpf', digitsOnly(e.target.value))} disabled={saving} maxLength={14}
                  placeholder="000.000.000-00" style={inputStyle(Boolean(errors.cpf))} aria-invalid={Boolean(errors.cpf)} />
              </Field>
              <Field label="Data de nascimento" htmlFor="cfg-nasc" error={errors.dataNasc}>
                <input id="cfg-nasc" name="bday" type="date" value={form.dataNasc}
                  onChange={e => setField('dataNasc', e.target.value)} disabled={saving}
                  max={new Date().toISOString().slice(0, 10)} style={inputStyle(Boolean(errors.dataNasc))} />
              </Field>
              <Field label="Sexo" htmlFor="cfg-sexo" error={errors.sexo}>
                <select id="cfg-sexo" name="sex" value={form.sexo}
                  onChange={e => setField('sexo', e.target.value)} disabled={saving} style={inputStyle(false)}>
                  <option value="">Selecione</option>
                  {SEXO_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
            </FormSection>

            <FormSection title="Contato" icon={Bell}>
              <Field label="E-mail" htmlFor="cfg-email" error={errors.email} hint="E-mail usado no seu cadastro de paciente.">
                <input id="cfg-email" name="email" type="email" inputMode="email" autoComplete="email" value={form.email}
                  onChange={e => setField('email', e.target.value)} disabled={saving}
                  style={inputStyle(Boolean(errors.email))} aria-invalid={Boolean(errors.email)} />
              </Field>
              <Field label="Telefone (celular)" htmlFor="cfg-tel" error={errors.telefone}>
                <input id="cfg-tel" name="tel" type="tel" inputMode="tel" autoComplete="tel" value={formatPhoneBR(form.telefone)}
                  onChange={e => setField('telefone', digitsOnly(e.target.value))} disabled={saving} maxLength={16}
                  placeholder="(00) 00000-0000" style={inputStyle(Boolean(errors.telefone))} aria-invalid={Boolean(errors.telefone)} />
              </Field>
              <Field label="Telefone alternativo" htmlFor="cfg-tel2" error={errors.telefone2}>
                <input id="cfg-tel2" name="tel-alt" type="tel" inputMode="tel" value={formatPhoneBR(form.telefone2)}
                  onChange={e => setField('telefone2', digitsOnly(e.target.value))} disabled={saving} maxLength={16}
                  placeholder="(00) 00000-0000" style={inputStyle(Boolean(errors.telefone2))} aria-invalid={Boolean(errors.telefone2)} />
              </Field>
            </FormSection>

            <FormSection title="Endereço" icon={MapPin}>
              <Field label="CEP" htmlFor="cfg-cep" error={errors.cep}>
                <input id="cfg-cep" name="postal-code" type="text" inputMode="numeric" autoComplete="postal-code" value={formatCep(form.cep)}
                  onChange={e => setField('cep', digitsOnly(e.target.value))} disabled={saving} maxLength={9}
                  placeholder="00000-000" style={inputStyle(Boolean(errors.cep))} aria-invalid={Boolean(errors.cep)} />
              </Field>
              <Field label="Logradouro" htmlFor="cfg-rua" error={errors.logradouro}>
                <input id="cfg-rua" name="address-line1" type="text" autoComplete="address-line1" value={form.logradouro}
                  onChange={e => setField('logradouro', e.target.value)} disabled={saving} style={inputStyle(false)} />
              </Field>
              <Field label="Número" htmlFor="cfg-num" error={errors.numero}>
                <input id="cfg-num" name="address-number" type="text" inputMode="numeric" value={form.numero}
                  onChange={e => setField('numero', e.target.value)} disabled={saving} maxLength={10} style={inputStyle(false)} />
              </Field>
              <Field label="Complemento" htmlFor="cfg-compl" error={errors.complemento}>
                <input id="cfg-compl" name="address-line2" type="text" autoComplete="address-line2" value={form.complemento}
                  onChange={e => setField('complemento', e.target.value)} disabled={saving} style={inputStyle(false)} />
              </Field>
              <Field label="Bairro" htmlFor="cfg-bairro" error={errors.bairro}>
                <input id="cfg-bairro" name="address-level3" type="text" value={form.bairro}
                  onChange={e => setField('bairro', e.target.value)} disabled={saving} style={inputStyle(false)} />
              </Field>
              <Field label="Cidade" htmlFor="cfg-cidade" error={errors.cidade}>
                <input id="cfg-cidade" name="address-level2" type="text" autoComplete="address-level2" value={form.cidade}
                  onChange={e => setField('cidade', e.target.value)} disabled={saving} style={inputStyle(false)} />
              </Field>
              <Field label="Estado (UF)" htmlFor="cfg-uf" error={errors.estado}>
                <input id="cfg-uf" name="address-level1" type="text" autoComplete="address-level1" value={form.estado}
                  onChange={e => setField('estado', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} disabled={saving}
                  maxLength={2} placeholder="UF" style={inputStyle(Boolean(errors.estado))} aria-invalid={Boolean(errors.estado)} />
              </Field>
              <Field label="Ponto de referência" htmlFor="cfg-ref" error={errors.referencia}>
                <input id="cfg-ref" name="reference" type="text" value={form.referencia}
                  onChange={e => setField('referencia', e.target.value)} disabled={saving} style={inputStyle(false)} />
              </Field>
            </FormSection>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="submit" disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${hasError ? 'var(--red-300, #fca5a5)' : 'var(--gray-200)'}`,
    fontSize: 14,
    color: 'var(--gray-800, #1f2937)',
    background: '#fff',
    outline: 'none',
  };
}

function FormSection({ title, icon: Icon, children }: { title: string; icon: ElementType; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color="var(--primary)" /> {title}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>{children}</div>
    </div>
  );
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)' }}>{label}</label>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{hint}</span>}
      {error && <span role="alert" style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-600)' }}>{error}</span>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: ElementType; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color="var(--primary)" /> {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--gray-50)' }}>
      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
