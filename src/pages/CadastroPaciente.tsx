import { useState } from 'react';
import type { ElementType, FormEvent, ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  IdCard,
  Loader2,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { usersApi } from '../lib/api';
import type { PatientCreatePayload } from '../lib/api';
import { digitsOnly, formatCpf, isValidCpf } from '../shared/utils/cpf';
import { formatPhoneBR, isValidEmail, isValidISODate, isValidPhoneBR, normalizeEmail, normalizePhoneBR } from '../shared/utils/validation';

interface CadastroPacienteProps {
  onBackToLogin: () => void;
}

const PROJECT_MARK_SRC = '/mediconnect-mark.png';

type FormState = {
  full_name: string;
  email: string;
  cpf: string;
  phone_mobile: string;
  birth_date: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  full_name: '',
  email: '',
  cpf: '',
  phone_mobile: '',
  birth_date: '',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.full_name.trim()) errors.full_name = 'Informe seu nome completo.';
  if (!isValidEmail(form.email)) errors.email = 'E-mail inválido.';
  if (!isValidCpf(form.cpf)) errors.cpf = 'Informe um CPF válido.';
  if (!isValidPhoneBR(form.phone_mobile)) errors.phone_mobile = 'Informe um telefone válido.';
  if (!isValidISODate(form.birth_date)) {
    errors.birth_date = 'Informe uma data de nascimento válida.';
  } else if (form.birth_date > todayISO()) {
    errors.birth_date = 'A data de nascimento não pode ser futura.';
  }
  return errors;
}

function formatApiError(err: unknown) {
  const msg = err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.';
  const lower = msg.toLowerCase();
  if (lower.includes('already') || lower.includes('duplicate') || lower.includes('exists') || msg.includes('409')) {
    return 'Ja existe um cadastro para este e-mail ou CPF.';
  }
  if (lower.includes('invalid') && lower.includes('email')) return 'E-mail inválido.';
  if (msg.includes('400')) return 'Confira nome, e-mail, CPF, telefone e data de nascimento antes de continuar.';
  if (msg.includes('401') || msg.includes('403')) return 'Erro ao criar conta. Tente novamente.';
  if (lower.includes('rate') || lower.includes('too many') || msg.includes('429')) {
    return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.';
  }
  return msg || 'Erro ao criar conta. Tente novamente.';
}

const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

export default function CadastroPaciente({ onBackToLogin }: CadastroPacienteProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

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

    const payload: PatientCreatePayload = {
      email: normalizeEmail(form.email),
      full_name: form.full_name.trim(),
      cpf: digitsOnly(form.cpf),
      phone_mobile: normalizePhoneBR(form.phone_mobile),
      birth_date: form.birth_date,
      redirect_url: window.location.origin,
    };

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await usersApi.createPatientAccount(payload);
      setSuccess(response.message ?? 'Link mágico enviado para seu e-mail. Verifique sua caixa de entrada.');
      setForm(emptyForm);
      setFieldErrors({});
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="patient-signup-page" aria-labelledby="patient-signup-title">
      <section className="patient-signup-shell">
        <div className="patient-signup-left">
          <header className="patient-signup-brand" aria-label="MediConnect">
            <span className="patient-signup-logo" aria-hidden="true">
              <img src={PROJECT_MARK_SRC} alt="" />
            </span>
            <span className="patient-signup-brand-copy">
              <span className="patient-signup-brand-name">MediConnect</span>
              <span className="patient-signup-brand-caption">Gestao Inteligente de Saude</span>
            </span>
          </header>

          <div className="patient-signup-card">
            <div className="patient-signup-header">
              <div>
                <p className="patient-signup-kicker">Novo cadastro</p>
                <h1 id="patient-signup-title">Criar conta de paciente</h1>
                <p>Preencha os dados para receber o link mágico de acesso.</p>
              </div>
              <button type="button" className="patient-signup-back" onClick={onBackToLogin}>
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
              </button>
            </div>

            <form className="patient-signup-form" onSubmit={handleSubmit}>
              {error && <MessageBox tone="error" icon={AlertCircle} text={error} />}
              {success && <MessageBox tone="success" icon={CheckCircle2} text={success} />}

              <div className="patient-signup-grid">
                <Field id="patient-full-name" label="Nome completo" icon={User} error={fieldErrors.full_name}>
                  <input
                    id="patient-full-name"
                    value={form.full_name}
                    onChange={event => setField('full_name', event.target.value)}
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    maxLength={120}
                    required
                    disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
                    aria-invalid={Boolean(fieldErrors.phone_mobile)}
                    aria-describedby={fieldErrors.phone_mobile ? 'patient-phone-error' : undefined}
                  />
                </Field>

                <Field id="patient-birth-date" label="Data de nascimento" icon={CalendarDays} error={fieldErrors.birth_date}>
                  <input
                    id="patient-birth-date"
                    type="date"
                    value={form.birth_date}
                    onChange={event => setField('birth_date', event.target.value)}
                    autoComplete="bday"
                    max={todayISO()}
                    required
                    disabled={saving}
                    aria-invalid={Boolean(fieldErrors.birth_date)}
                    aria-describedby={fieldErrors.birth_date ? 'patient-birth-date-error' : undefined}
                  />
                </Field>
              </div>

              <button type="submit" className="patient-signup-submit" disabled={saving} aria-busy={saving}>
                {saving ? (
                  <>
                    <Loader2 size={18} className="patient-signup-spinner" aria-hidden="true" />
                    Enviando link...
                  </>
                ) : (
                  <>
                    Enviar link mágico
                    <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <aside className="patient-signup-hero" aria-label="Resumo da plataforma">
          <div className="patient-signup-copy">
            <h2>Seu cuidado conectado em um so lugar</h2>
            <p>Acompanhe consultas, atendimentos e informacoes clinicas com acesso seguro por e-mail.</p>
          </div>
        </aside>
      </section>

      <footer className="patient-signup-footer">© 2026 MediConnect. Todos os direitos reservados.</footer>

      <style>{`
        .patient-signup-page {
          width: 100%;
          min-height: 100dvh;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 42px 40px 54px;
          background:
            radial-gradient(circle at 55% 50%, rgba(175, 244, 213, 0.82) 0, rgba(198, 249, 225, 0.48) 22%, transparent 47%),
            radial-gradient(circle at 74% 3%, rgba(220, 252, 231, 0.8) 0, transparent 28%),
            linear-gradient(105deg, #fbfefc 0%, #f2fbf6 46%, #eaf9ef 100%);
          overflow-x: hidden;
          overflow-y: auto;
        }

        .patient-signup-page::before {
          content: '';
          position: absolute;
          width: min(78vw, 900px);
          height: min(78vw, 900px);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background:
            radial-gradient(circle at 43% 37%, rgba(0, 166, 63, 0.20), transparent 26%),
            radial-gradient(circle at 62% 42%, rgba(0, 158, 87, 0.22), transparent 31%);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(1px);
          opacity: 0.78;
        }

        .patient-signup-shell {
          position: relative;
          z-index: 1;
          width: min(100%, 1120px);
          min-height: 680px;
          display: grid;
          grid-template-columns: minmax(440px, 560px) minmax(400px, 1fr);
          column-gap: 64px;
          align-items: center;
        }

        .patient-signup-left { min-width: 0; }

        .patient-signup-brand {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 40px;
        }

        .patient-signup-logo {
          width: 48px;
          height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid rgba(0, 166, 63, 0.16);
          box-shadow: 0 14px 26px rgba(0, 176, 91, 0.16);
          flex-shrink: 0;
          overflow: hidden;
          padding: 5px;
        }

        .patient-signup-logo img {
          width: 220%;
          height: 220%;
          display: block;
          object-fit: contain;
        }

        .patient-signup-brand-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .patient-signup-brand-name {
          color: #111827;
          font-size: 30px;
          line-height: 1.08;
          font-weight: 800;
        }

        .patient-signup-brand-caption {
          margin-top: 12px;
          color: #475569;
          font-size: 14px;
          line-height: 1.25;
          font-weight: 500;
        }

        .patient-signup-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 24px;
        }

        .patient-signup-header h1 {
          margin: 0;
          color: #111827;
          font-size: 30px;
          line-height: 1.18;
          font-weight: 800;
        }

        .patient-signup-header p:last-child {
          margin-top: 8px;
          color: #475569;
          font-size: 14px;
          line-height: 1.6;
        }

        .patient-signup-kicker {
          margin: 0 0 10px;
          color: #00a34f;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .patient-signup-back {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid rgba(0, 176, 91, 0.24);
          border-radius: 12px;
          padding: 9px 13px;
          background: rgba(255, 255, 255, 0.72);
          color: #334155;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .patient-signup-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .patient-signup-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px 15px;
        }

        .patient-signup-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .patient-signup-field label {
          color: #334155;
          font-size: 13px;
          font-weight: 800;
        }

        .patient-signup-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .patient-signup-input-wrap > svg {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #9aa4b2;
          pointer-events: none;
        }

        .patient-signup-input-wrap input {
          width: 100%;
          min-height: 54px;
          border: 1.5px solid #9cf5bd;
          border-radius: 12px;
          padding: 13px 16px 13px 49px;
          background: rgba(255, 255, 255, 0.92);
          color: #1f2937;
          font-size: 14px;
          font-weight: 600;
          transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
        }

        .patient-signup-input-wrap input:hover,
        .patient-signup-input-wrap input:focus {
          border-color: #54e890;
          background: var(--white);
          box-shadow: 0 0 0 4px rgba(84, 232, 144, 0.15);
        }

        .patient-signup-input-wrap input[aria-invalid="true"] {
          border-color: var(--red-500);
          background: var(--red-50);
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
          background: linear-gradient(90deg, #05c956 0%, #00a566 100%);
          color: var(--white);
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 16px 28px rgba(0, 176, 91, 0.25);
        }

        .patient-signup-submit:disabled {
          cursor: not-allowed;
          background: #a7d9b8;
          box-shadow: none;
        }

        .patient-signup-hero {
          min-width: 0;
          min-height: 620px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .patient-signup-copy {
          max-width: 530px;
        }

        .patient-signup-copy h2 {
          margin: 0;
          color: #0f172a;
          font-size: 50px;
          line-height: 0.98;
          font-weight: 800;
        }

        .patient-signup-copy p {
          margin: 22px auto 0;
          max-width: 520px;
          color: #475569;
          font-size: 20px;
          line-height: 1.44;
          font-weight: 500;
        }

        .patient-signup-footer {
          position: absolute;
          left: 50%;
          bottom: 14px;
          z-index: 1;
          transform: translateX(-50%);
          color: #475569;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }

        .patient-signup-spinner {
          animation: patient-signup-spin 1s linear infinite;
        }

        @keyframes patient-signup-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 940px) {
          .patient-signup-page {
            align-items: flex-start;
            padding: 30px 24px 54px;
          }

          .patient-signup-shell {
            width: min(100%, 680px);
            min-height: auto;
            grid-template-columns: 1fr;
            gap: 42px;
          }

          .patient-signup-brand {
            margin-bottom: 36px;
          }

          .patient-signup-hero {
            order: -1;
            min-height: auto;
          }

          .patient-signup-copy h2 {
            font-size: 38px;
            line-height: 1.04;
          }

          .patient-signup-copy p {
            margin-top: 16px;
            font-size: 17px;
          }

          .patient-signup-footer {
            position: static;
            transform: none;
            margin-top: 20px;
          }
        }

        @media (max-width: 560px) {
          .patient-signup-page {
            padding: 22px 16px 28px;
          }

          .patient-signup-brand-name {
            font-size: 25px;
          }

          .patient-signup-header {
            flex-direction: column;
          }

          .patient-signup-header h1,
          .patient-signup-copy h2 {
            font-size: 30px;
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
