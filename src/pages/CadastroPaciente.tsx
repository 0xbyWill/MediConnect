import { useState } from 'react';
import type { ElementType, FormEvent, ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  IdCard,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { usersApi } from '../lib/api';
import type { CreateUserWithPasswordPayload } from '../lib/api';
import { digitsOnly, formatCpf, isValidCpf } from '../shared/utils/cpf';
import { formatPhoneBR, isValidEmail, isValidPhoneBR, normalizeEmail, normalizePhoneBR } from '../shared/utils/validation';

interface CadastroPacienteProps {
  onBackToLogin: () => void;
}

type FormState = {
  full_name: string;
  email: string;
  cpf: string;
  phone_mobile: string;
  password: string;
  confirm_password: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  full_name: '',
  email: '',
  cpf: '',
  phone_mobile: '',
  password: '',
  confirm_password: '',
};

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.full_name.trim()) errors.full_name = 'Informe seu nome completo.';
  if (!isValidEmail(form.email)) errors.email = 'Informe um e-mail válido.';
  if (!isValidCpf(form.cpf)) errors.cpf = 'Informe um CPF válido.';
  if (!isValidPhoneBR(form.phone_mobile)) errors.phone_mobile = 'Informe um telefone válido.';
  if (form.password.length < 6) errors.password = 'A senha deve ter pelo menos 6 caracteres.';
  if (form.password !== form.confirm_password) errors.confirm_password = 'As senhas informadas não conferem.';
  return errors;
}

function formatApiError(err: unknown) {
  const msg = err instanceof Error ? err.message : 'Não foi possível criar sua conta.';
  const lower = msg.toLowerCase();
  if (lower.includes('already') || lower.includes('duplicate') || lower.includes('exists')) {
    return 'Já existe uma conta ou paciente com esses dados.';
  }
  if (lower.includes('invalid') && lower.includes('email')) return 'Informe um e-mail válido.';
  if (msg.includes('400')) return 'Confira CPF, telefone, e-mail e senha antes de continuar.';
  if (msg.includes('401') || msg.includes('403')) {
    return 'Não foi possível criar a conta agora. Tente novamente ou procure a unidade de saúde.';
  }
  if (lower.includes('rate') || lower.includes('too many') || msg.includes('429')) return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
  if (msg.includes('409')) return 'Já existe um cadastro para este e-mail ou CPF.';
  return msg;
}

const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

export default function CadastroPaciente({ onBackToLogin }: CadastroPacienteProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validate(form);
    setFieldErrors(validationErrors);
    if (hasErrors(validationErrors)) {
      setError('Confira os campos destacados antes de continuar.');
      return;
    }

    const cleanPhone = normalizePhoneBR(form.phone_mobile);
    const formattedPhone = formatPhoneBR(cleanPhone);
    const payload: CreateUserWithPasswordPayload = {
      email: normalizeEmail(form.email),
      password: form.password,
      full_name: form.full_name.trim(),
      cpf: digitsOnly(form.cpf),
      phone: formattedPhone,
      phone_mobile: formattedPhone,
      role: 'paciente',
      create_patient_record: true,
    };

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await usersApi.createWithPassword(payload);
      setSuccess(response.message ?? 'Cadastro realizado com sucesso. Volte para o login e acesse com seu e-mail e senha.');
      setForm(emptyForm);
      setFieldErrors({});
    } catch (err) {
      setError(formatApiError(err));
      setSuccess('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="patient-signup-page" aria-labelledby="patient-signup-title">
      <section className="patient-signup-shell">
        <div className="patient-signup-intro">
          <div className="patient-signup-brand">
            <div className="patient-signup-logo" aria-hidden="true">
              <Heart size={24} fill="currentColor" />
            </div>
            <div>
              <p className="patient-signup-brand-name">MediConnect</p>
              <p className="patient-signup-brand-caption">Saúde pública conectada</p>
            </div>
          </div>

          <div className="patient-signup-copy">
            <p className="patient-signup-kicker">Conta de paciente</p>
            <h1>Crie seu acesso com tranquilidade</h1>
            <p>
              Informe seus dados para acompanhar consultas, atendimentos e informações clínicas
              disponibilizadas pela unidade de saúde.
            </p>
          </div>
        </div>

        <div className="patient-signup-card">
          <div className="patient-signup-header">
            <div>
              <p className="patient-signup-kicker">Novo cadastro</p>
              <h2 id="patient-signup-title">Criar conta de paciente</h2>
              <p>Preencha os campos abaixo para solicitar seu acesso.</p>
            </div>
            <button type="button" className="patient-signup-back" onClick={onBackToLogin}>
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar
            </button>
          </div>

          <form className="patient-signup-form" onSubmit={handleSubmit}>
            {error && (
              <MessageBox tone="error" icon={AlertCircle} text={error} />
            )}
            {success && (
              <MessageBox tone="success" icon={CheckCircle2} text={success} />
            )}

            <div className="patient-signup-grid">
              <Field id="patient-full-name" label="Nome completo" icon={User} error={fieldErrors.full_name}>
                <input
                  id="patient-full-name"
                  value={form.full_name}
                  onChange={event => setField('full_name', event.target.value)}
                  placeholder="Maria Santos"
                  autoComplete="name"
                  maxLength={120}
                  required
                  aria-invalid={Boolean(fieldErrors.full_name)}
                  aria-describedby={fieldErrors.full_name ? 'patient-full-name-error' : undefined}
                />
              </Field>

              <Field id="patient-email" label="E-mail" icon={Mail} error={fieldErrors.email}>
                <input
                  id="patient-email"
                  type="email"
                  value={form.email}
                  onChange={event => setField('email', event.target.value)}
                  placeholder="paciente@exemplo.com"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={160}
                  required
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'patient-email-error' : undefined}
                />
              </Field>

              <Field id="patient-cpf" label="CPF" icon={IdCard} error={fieldErrors.cpf}>
                <input
                  id="patient-cpf"
                  value={form.cpf}
                  onChange={event => setField('cpf', formatCpf(event.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  required
                  aria-invalid={Boolean(fieldErrors.cpf)}
                  aria-describedby={fieldErrors.cpf ? 'patient-cpf-error' : undefined}
                />
              </Field>

              <Field id="patient-phone" label="Telefone" icon={Phone} error={fieldErrors.phone_mobile}>
                <input
                  id="patient-phone"
                  value={form.phone_mobile}
                  onChange={event => setField('phone_mobile', formatPhoneBR(event.target.value))}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={15}
                  required
                  aria-invalid={Boolean(fieldErrors.phone_mobile)}
                  aria-describedby={fieldErrors.phone_mobile ? 'patient-phone-error' : undefined}
                />
              </Field>

              <Field id="patient-password" label="Senha" icon={Lock} error={fieldErrors.password}>
                <input
                  id="patient-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={event => setField('password', event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={72}
                  required
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'patient-password-error' : undefined}
                />
                <PasswordToggle
                  active={showPassword}
                  onClick={() => setShowPassword(value => !value)}
                />
              </Field>

              <Field id="patient-confirm-password" label="Confirmar senha" icon={Lock} error={fieldErrors.confirm_password}>
                <input
                  id="patient-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirm_password}
                  onChange={event => setField('confirm_password', event.target.value)}
                  placeholder="Repita sua senha"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={72}
                  required
                  aria-invalid={Boolean(fieldErrors.confirm_password)}
                  aria-describedby={fieldErrors.confirm_password ? 'patient-confirm-password-error' : undefined}
                />
                <PasswordToggle
                  active={showConfirmPassword}
                  onClick={() => setShowConfirmPassword(value => !value)}
                />
              </Field>
            </div>

            <button type="submit" className="patient-signup-submit" disabled={saving} aria-busy={saving}>
              {saving ? (
                <>
                  <Loader2 size={18} className="patient-signup-spinner" aria-hidden="true" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar minha conta
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      <style>{`
        .patient-signup-page {
          width: 100%;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          background:
            radial-gradient(circle at 88% 16%, rgba(222, 245, 223, 0.8), transparent 28%),
            linear-gradient(135deg, var(--background) 0%, #eef8ef 44%, #f9fafb 100%);
          overflow-x: hidden;
          overflow-y: auto;
        }

        .patient-signup-shell {
          width: min(100%, 1060px);
          min-height: 620px;
          display: grid;
          grid-template-columns: minmax(360px, 0.82fr) minmax(0, 1.18fr);
          overflow: hidden;
          border: 1px solid rgba(31, 111, 56, 0.12);
          border-radius: 28px;
          background: var(--white);
          box-shadow: 0 28px 70px rgba(16, 24, 40, 0.16);
        }

        .patient-signup-intro {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 44px;
          padding: 42px;
          color: var(--white);
          background:
            linear-gradient(145deg, rgba(23, 79, 40, 0.96), rgba(31, 111, 56, 0.9)),
            linear-gradient(135deg, var(--darker), var(--dark));
        }

        .patient-signup-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .patient-signup-logo {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--white);
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.2);
          flex-shrink: 0;
        }

        .patient-signup-brand-name {
          margin: 0;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 800;
        }

        .patient-signup-brand-caption {
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.74);
          font-size: 12px;
          font-weight: 600;
        }

        .patient-signup-copy h1 {
          margin: 0;
          color: var(--white);
          font-size: 36px;
          line-height: 1.12;
          font-weight: 800;
        }

        .patient-signup-copy p:last-child {
          margin-top: 18px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 15px;
          line-height: 1.7;
        }

        .patient-signup-kicker {
          margin: 0 0 10px;
          color: var(--primary);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .patient-signup-intro .patient-signup-kicker {
          color: var(--mint);
        }

        .patient-signup-card {
          padding: 38px;
          background: var(--white);
        }

        .patient-signup-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 26px;
        }

        .patient-signup-header h2 {
          margin: 0;
          color: var(--gray-800);
          font-size: 26px;
          line-height: 1.2;
          font-weight: 800;
        }

        .patient-signup-header p:last-child {
          margin-top: 8px;
          color: var(--gray-500);
          font-size: 14px;
          line-height: 1.55;
        }

        .patient-signup-back {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid var(--gray-200);
          border-radius: 12px;
          padding: 9px 13px;
          background: var(--white);
          color: var(--gray-700);
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
          transition: border-color .18s ease, color .18s ease, background .18s ease;
        }

        .patient-signup-back:hover {
          border-color: rgba(58, 170, 53, 0.3);
          background: var(--mint);
          color: var(--dark);
        }

        .patient-signup-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .patient-signup-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .patient-signup-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .patient-signup-field label {
          color: var(--gray-700);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .patient-signup-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .patient-signup-input-wrap > svg {
          position: absolute;
          left: 14px;
          color: var(--gray-400);
          pointer-events: none;
          transition: color .18s ease;
        }

        .patient-signup-input-wrap input {
          width: 100%;
          min-height: 48px;
          border: 1px solid var(--gray-200);
          border-radius: 12px;
          padding: 12px 44px;
          background: var(--gray-50);
          color: var(--gray-800);
          font-size: 14px;
          transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
        }

        .patient-signup-input-wrap input::placeholder {
          color: var(--gray-400);
        }

        .patient-signup-input-wrap:focus-within > svg {
          color: var(--primary);
        }

        .patient-signup-input-wrap input:hover {
          border-color: #c9d6ce;
          background: var(--white);
        }

        .patient-signup-input-wrap input:focus {
          border-color: var(--primary);
          background: var(--white);
          box-shadow: var(--focus-ring);
        }

        .patient-signup-input-wrap input[aria-invalid="true"] {
          border-color: var(--red-500);
          background: var(--red-50);
        }

        .patient-signup-password-toggle {
          position: absolute;
          right: 9px;
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--gray-500);
        }

        .patient-signup-password-toggle:hover {
          background: var(--mint);
          color: var(--dark);
        }

        .patient-signup-field-error {
          color: var(--red-600);
          font-size: 12px;
          font-weight: 700;
          line-height: 1.35;
        }

        .patient-signup-message {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.45;
        }

        .patient-signup-message svg {
          margin-top: 1px;
          flex-shrink: 0;
        }

        .patient-signup-message-error {
          border: 1px solid var(--red-100);
          background: var(--red-50);
          color: var(--red-600);
        }

        .patient-signup-message-success {
          border: 1px solid rgba(58, 170, 53, 0.28);
          background: var(--mint);
          color: var(--dark);
        }

        .patient-signup-submit {
          min-height: 52px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary), var(--dark));
          color: var(--white);
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 14px 24px rgba(58, 170, 53, 0.24);
          transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
        }

        .patient-signup-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 30px rgba(58, 170, 53, 0.3);
          filter: saturate(1.04);
        }

        .patient-signup-submit:disabled {
          cursor: not-allowed;
          background: var(--gray-300);
          box-shadow: none;
        }

        .patient-signup-spinner {
          animation: patient-signup-spin 1s linear infinite;
        }

        @keyframes patient-signup-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 960px) {
          .patient-signup-page {
            padding: 24px;
            align-items: flex-start;
          }

          .patient-signup-shell {
            min-height: auto;
            grid-template-columns: 1fr;
            width: min(100%, 720px);
          }

          .patient-signup-intro {
            min-height: auto;
            padding: 32px;
            gap: 28px;
          }

          .patient-signup-copy h1 {
            font-size: 30px;
          }

          .patient-signup-card {
            padding: 32px;
          }
        }

        @media (max-width: 680px) {
          .patient-signup-page {
            padding: 16px;
          }

          .patient-signup-shell {
            border-radius: 20px;
          }

          .patient-signup-intro {
            padding: 26px 20px;
          }

          .patient-signup-copy h1 {
            font-size: 26px;
          }

          .patient-signup-card {
            padding: 26px 20px;
          }

          .patient-signup-header {
            flex-direction: column;
          }

          .patient-signup-back {
            width: 100%;
          }

          .patient-signup-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  error,
  children,
}: {
  id: string;
  label: string;
  icon: ElementType;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="patient-signup-field">
      <label htmlFor={id}>{label}</label>
      <div className="patient-signup-input-wrap">
        <Icon size={17} aria-hidden="true" />
        {children}
      </div>
      {error && (
        <p id={`${id}-error`} className="patient-signup-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="patient-signup-password-toggle"
      onClick={onClick}
      aria-label={active ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {active ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  );
}

function MessageBox({ tone, icon: Icon, text }: { tone: 'error' | 'success'; icon: ElementType; text: string }) {
  const isError = tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`patient-signup-message patient-signup-message-${tone}`}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
