import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Heart,
  Loader2,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { usersApi } from '../lib/api';
import type { PatientCreatePayload } from '../lib/api';
import { dateToISO } from '../shared/utils/date';
import { digitsOnly, formatCpf, isValidCpf } from '../shared/utils/cpf';
import { formatPhoneBR, normalizeEmail } from '../shared/utils/validation';

interface CadastroPacienteProps {
  onBackToLogin: () => void;
}

type FormState = {
  full_name: string;
  email: string;
  cpf: string;
  phone_mobile: string;
  birth_date: string;
};

const emptyForm: FormState = {
  full_name: '',
  email: '',
  cpf: '',
  phone_mobile: '',
  birth_date: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function todayISO() {
  return dateToISO(new Date());
}

function validate(form: FormState): string | null {
  if (!form.full_name.trim()) return 'Informe seu nome completo.';
  if (!EMAIL_RE.test(form.email.trim())) return 'Informe um e-mail válido.';
  if (!isValidCpf(form.cpf)) return 'Informe um CPF válido.';
  if (digitsOnly(form.phone_mobile).length < 10) return 'Informe um telefone válido.';
  if (!form.birth_date) return 'Informe sua data de nascimento.';
  if (form.birth_date >= todayISO()) return 'A data de nascimento deve ser anterior a hoje.';
  return null;
}

function formatApiError(err: unknown) {
  const msg = err instanceof Error ? err.message : 'Não foi possível criar sua conta.';
  const lower = msg.toLowerCase();
  if (lower.includes('already') || lower.includes('duplicate') || lower.includes('exists')) {
    return 'Já existe uma conta ou paciente com esses dados.';
  }
  if (lower.includes('invalid') && lower.includes('email')) return 'Informe um e-mail válido.';
  if (msg.includes('400')) return 'A API recusou os dados. Confira CPF, telefone, nascimento e e-mail.';
  if (msg.includes('401') || msg.includes('403')) {
    return 'A API bloqueou o auto-cadastro público. Verifique as permissões da função register-patient.';
  }
  if (lower.includes('rate') || lower.includes('too many') || msg.includes('429')) return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
  if (msg.includes('409')) return 'Já existe um cadastro para este e-mail ou CPF.';
  return msg;
}

export default function CadastroPaciente({ onBackToLogin }: CadastroPacienteProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: PatientCreatePayload = {
      email: normalizeEmail(form.email),
      full_name: form.full_name.trim(),
      cpf: digitsOnly(form.cpf),
      phone_mobile: digitsOnly(form.phone_mobile),
      birth_date: form.birth_date,
      redirect_url: window.location.origin,
    };

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await usersApi.createPatientAccount(payload);
      setSuccess(response.message ?? 'Cadastro realizado com sucesso. Verifique seu e-mail para acessar a plataforma.');
    } catch (err) {
      setError(formatApiError(err));
      setSuccess('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--darker) 0%, var(--dark) 55%, #2d8a45 100%)',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 760,
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '28px 32px 22px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--primary), var(--dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(58,170,53,0.35)', flexShrink: 0 }}>
              <Heart size={22} color="#fff" fill="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--dark)', margin: 0 }}>Criar conta de paciente</h1>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>Preencha seus dados para receber o acesso por e-mail.</p>
            </div>
          </div>
          <button type="button" onClick={onBackToLogin} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--gray-200)', background: '#fff', borderRadius: 10, padding: '9px 12px', color: 'var(--gray-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <ArrowLeft size={15} /> Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 32px 30px' }}>
          {error && (
            <MessageBox tone="error" icon={AlertCircle} text={error} />
          )}
          {success && (
            <MessageBox tone="success" icon={CheckCircle2} text={success} />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <Field label="Nome completo" icon={User}>
              <input value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Seu nome completo" autoComplete="name" style={fieldStyle} />
            </Field>

            <Field label="E-mail" icon={Mail}>
              <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="paciente@email.com" autoComplete="email" style={fieldStyle} />
            </Field>

            <Field label="CPF" icon={User}>
              <input value={form.cpf} onChange={e => setField('cpf', formatCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} style={fieldStyle} />
            </Field>

            <Field label="Telefone" icon={Phone}>
              <input value={form.phone_mobile} onChange={e => setField('phone_mobile', formatPhoneBR(e.target.value))} placeholder="(11) 99999-9999" autoComplete="tel" inputMode="tel" maxLength={15} style={fieldStyle} />
            </Field>

            <Field label="Nascimento" icon={Calendar}>
              <input type="date" max={todayISO()} value={form.birth_date} onChange={e => setField('birth_date', e.target.value)} autoComplete="bday" style={fieldStyle} />
            </Field>

          </div>

          <button type="submit" disabled={saving} style={{
            width: '100%',
            marginTop: 22,
            padding: '12px 16px',
            border: 'none',
            borderRadius: 12,
            background: saving ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--primary), var(--dark))',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: saving ? 'none' : '0 4px 14px rgba(58,170,53,0.35)',
          }}>
            {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Criando conta...</> : 'Criar minha conta'}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--gray-600)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  display: 'block',
  marginBottom: 6,
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px 11px 36px',
  border: '1px solid var(--gray-200)',
  borderRadius: 10,
  fontSize: 13,
  outline: 'none',
  background: 'var(--gray-50)',
  color: 'var(--gray-800)',
};

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Icon size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
        {children}
      </div>
    </div>
  );
}

function MessageBox({ tone, icon: Icon, text }: { tone: 'error' | 'success'; icon: React.ElementType; text: string }) {
  const isError = tone === 'error';
  return (
    <div role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'} style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      background: isError ? 'var(--red-50)' : 'var(--mint)',
      border: `1px solid ${isError ? 'var(--red-100)' : 'var(--light)'}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 18,
    }}>
      <Icon size={16} color={isError ? 'var(--red-500)' : 'var(--primary)'} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 13, color: isError ? 'var(--red-600)' : 'var(--dark)', fontWeight: 600 }}>{text}</span>
    </div>
  );
}
