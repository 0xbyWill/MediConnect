import { useState } from 'react';
import type { ElementType, FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  Eye,
  EyeOff,
  Heart,
  Loader2,
  Lock,
  Mail,
  Shield,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onCreateAccount?: () => void;
}

export default function Login({ onCreateAccount }: LoginProps) {
  const { login, loginMockPatient, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    await login(email.trim(), password);
  };

  const handleEmailChange = (value: string) => {
    if (error) clearError();
    setEmail(value);
  };

  const handlePasswordChange = (value: string) => {
    if (error) clearError();
    setPassword(value);
  };

  const quickLogin = async (preset: { email: string; password: string }) => {
    setEmail(preset.email);
    setPassword(preset.password);
    clearError();
    await login(preset.email, preset.password);
  };

  const demoPatient = () => {
    clearError();
    loginMockPatient();
  };

  return (
    <main className="login-page" aria-labelledby="login-title">
      <section className="login-shell">
        <div className="login-brand-panel" aria-label="MediConnect">
          <div className="login-logo-row">
            <div className="login-logo-mark" aria-hidden="true">
              <Heart size={24} fill="currentColor" />
            </div>
            <div>
              <p className="login-brand-name">MediConnect</p>
              <p className="login-brand-caption">Saúde pública conectada</p>
            </div>
          </div>

          <div className="login-institutional-copy">
            <p className="login-kicker">Gestão inteligente de saúde pública</p>
            <h1>Acesse sua conta com segurança</h1>
            <p>
              Gerencie atendimentos, pacientes e serviços clínicos em uma área
              simples, organizada e preparada para a rotina das unidades de saúde.
            </p>
          </div>

          <div className="login-service-list" aria-label="Recursos principais">
            <span>Atendimentos</span>
            <span>Pacientes</span>
            <span>Serviços clínicos</span>
          </div>
        </div>

        <div className="login-card" aria-label="Entrada no sistema">
          <div className="login-mobile-brand" aria-hidden="true">
            <div className="login-logo-mark">
              <Heart size={22} fill="currentColor" />
            </div>
            <div>
              <p className="login-brand-name">MediConnect</p>
              <p className="login-brand-caption">Saúde pública conectada</p>
            </div>
          </div>

          <div className="login-heading">
            <p className="login-kicker">Bem-vindo de volta</p>
            <h2 id="login-title">Entrar no sistema</h2>
            <p>Acesse sua conta para gerenciar atendimentos, pacientes e serviços clínicos.</p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="login-email">E-mail</label>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={event => handleEmailChange(event.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={120}
                  required
                  aria-invalid={Boolean(error)}
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="login-password">Senha</label>
                <button type="button" className="login-forgot-button">
                  Esqueceu a senha?
                </button>
              </div>
              <div className="login-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={event => handlePasswordChange(event.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  maxLength={72}
                  required
                  aria-invalid={Boolean(error)}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={!canSubmit} aria-busy={loading}>
              {loading ? (
                <>
                  <Loader2 size={18} className="login-spinner" aria-hidden="true" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar no sistema
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {onCreateAccount && (
            <div className="login-create-account">
              <span>Ainda não tem conta?</span>
              <button type="button" onClick={onCreateAccount}>
                Criar nova conta
              </button>
            </div>
          )}
        </div>
      </section>

      <aside className="login-quick-access" aria-label="Acessos rápidos">
        <div className="login-quick-header">
          <h2>Acessos rápidos</h2>
          <p>Ambiente de teste</p>
        </div>

        <QuickAccessButton
          icon={Stethoscope}
          title="Médico"
          subtitle="Agenda, pacientes e laudos"
          color="var(--primary)"
          disabled={loading}
          onClick={() => void quickLogin({ email: 'francisco.squad04@gmail.com', password: 'Teste@123' })}
        />
        <QuickAccessButton
          icon={ClipboardList}
          title="Secretaria"
          subtitle="Agenda e cadastro de pacientes"
          color="var(--amber-600)"
          disabled={loading}
          onClick={() => void quickLogin({ email: 'secretaria.squad04@gmail.com', password: 'Teste@123' })}
        />
        <QuickAccessButton
          icon={Shield}
          title="Gestor"
          subtitle="Acesso administrativo"
          color="#7c3aed"
          disabled={loading}
          onClick={() => void quickLogin({ email: 'hugo@popcode.com.br', password: 'hdoria' })}
        />

        <div className="login-quick-divider" />

        <QuickAccessButton
          icon={UserRound}
          title="Paciente"
          subtitle="Visualizar perfil do paciente"
          color="#2563eb"
          disabled={loading}
          onClick={demoPatient}
        />
      </aside>

      <style>{`
        .login-page {
          width: 100%;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          background:
            radial-gradient(circle at 12% 18%, rgba(222, 245, 223, 0.85), transparent 30%),
            linear-gradient(135deg, var(--background) 0%, #eef8ef 46%, #f9fafb 100%);
          overflow-x: hidden;
          overflow-y: auto;
        }

        .login-shell {
          width: min(100%, 1060px);
          min-height: 620px;
          display: grid;
          grid-template-columns: minmax(360px, 0.82fr) minmax(0, 1.18fr);
          border: 1px solid rgba(31, 111, 56, 0.12);
          border-radius: 28px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.82);
          box-shadow: 0 28px 70px rgba(16, 24, 40, 0.16);
        }

        .login-brand-panel {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 44px;
          background:
            linear-gradient(145deg, rgba(23, 79, 40, 0.94), rgba(31, 111, 56, 0.9)),
            linear-gradient(135deg, var(--darker), var(--dark));
          color: var(--white);
        }

        .login-logo-row,
        .login-mobile-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .login-logo-mark {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--white);
          background: linear-gradient(135deg, var(--primary), var(--dark));
          box-shadow: 0 12px 28px rgba(17, 130, 58, 0.34);
          flex-shrink: 0;
        }

        .login-brand-panel .login-logo-mark {
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: none;
        }

        .login-brand-name {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          line-height: 1.1;
          color: inherit;
        }

        .login-brand-caption {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.74);
        }

        .login-mobile-brand {
          display: none;
          color: var(--dark);
          margin-bottom: 28px;
        }

        .login-mobile-brand .login-brand-caption {
          color: var(--gray-500);
        }

        .login-institutional-copy {
          max-width: 500px;
        }

        .login-kicker {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--primary);
        }

        .login-brand-panel .login-kicker {
          color: var(--mint);
        }

        .login-institutional-copy h1 {
          margin: 0;
          max-width: 480px;
          font-size: 42px;
          line-height: 1.08;
          font-weight: 800;
          color: var(--white);
        }

        .login-institutional-copy p:last-child {
          margin-top: 18px;
          max-width: 520px;
          font-size: 15px;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.82);
        }

        .login-service-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .login-service-list span {
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          padding: 9px 13px;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.86);
          font-size: 12px;
          font-weight: 700;
        }

        .login-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: var(--white);
        }

        .login-card > .login-mobile-brand,
        .login-card > .login-heading,
        .login-card > .login-error,
        .login-card > .login-form,
        .login-card > .login-create-account {
          width: min(100%, 380px);
        }

        .login-heading {
          margin-bottom: 28px;
        }

        .login-heading h2 {
          margin: 0;
          color: var(--gray-800);
          font-size: 28px;
          line-height: 1.2;
          font-weight: 800;
        }

        .login-heading p:last-child {
          margin-top: 10px;
          color: var(--gray-500);
          font-size: 14px;
          line-height: 1.6;
        }

        .login-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 18px;
          padding: 13px 14px;
          border-radius: 12px;
          border: 1px solid var(--red-100);
          background: var(--red-50);
          color: var(--red-600);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.45;
        }

        .login-error svg {
          margin-top: 1px;
          flex-shrink: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .login-field label {
          color: var(--gray-700);
          font-size: 13px;
          font-weight: 800;
        }

        .login-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .login-input-wrap > svg {
          position: absolute;
          left: 15px;
          color: var(--gray-400);
          pointer-events: none;
          transition: color .18s ease;
        }

        .login-input-wrap input {
          width: 100%;
          min-height: 48px;
          border: 1px solid var(--gray-200);
          border-radius: 12px;
          padding: 12px 46px 12px 44px;
          background: var(--gray-50);
          color: var(--gray-800);
          font-size: 14px;
          transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
        }

        .login-input-wrap input::placeholder {
          color: var(--gray-400);
        }

        .login-input-wrap:focus-within > svg {
          color: var(--primary);
        }

        .login-input-wrap input:hover {
          border-color: #c9d6ce;
          background: var(--white);
        }

        .login-input-wrap input:focus {
          border-color: var(--primary);
          background: var(--white);
          box-shadow: var(--focus-ring);
        }

        .login-input-wrap input:invalid:not(:placeholder-shown) {
          border-color: var(--red-500);
        }

        .login-password-toggle,
        .login-forgot-button,
        .login-create-account button {
          border: 0;
          background: transparent;
          color: var(--primary);
          font-weight: 800;
        }

        .login-password-toggle {
          position: absolute;
          right: 10px;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-500);
        }

        .login-password-toggle:hover {
          background: var(--mint);
          color: var(--dark);
        }

        .login-forgot-button {
          padding: 2px 0;
          font-size: 12px;
        }

        .login-forgot-button:hover,
        .login-create-account button:hover {
          color: var(--dark);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .login-submit {
          min-height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 4px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary), var(--dark));
          color: var(--white);
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 14px 24px rgba(58, 170, 53, 0.24);
          transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
        }

        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 30px rgba(58, 170, 53, 0.3);
          filter: saturate(1.04);
        }

        .login-submit:disabled {
          cursor: not-allowed;
          background: var(--gray-300);
          box-shadow: none;
        }

        .login-spinner {
          animation: login-spin 1s linear infinite;
        }

        .login-create-account {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 22px;
          color: var(--gray-500);
          font-size: 13px;
          font-weight: 600;
        }

        .login-create-account button {
          padding: 0;
          font-size: 13px;
        }

        .login-quick-access {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 5;
          width: min(286px, calc(100vw - 44px));
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px;
          border: 1px solid rgba(31, 111, 56, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 18px 44px rgba(16, 24, 40, 0.18);
          backdrop-filter: blur(12px);
        }

        .login-quick-header h2 {
          margin: 0;
          color: var(--gray-800);
          font-size: 13px;
          font-weight: 800;
        }

        .login-quick-header p {
          margin-top: 2px;
          color: var(--gray-500);
          font-size: 11px;
          font-weight: 600;
        }

        .login-quick-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--gray-100);
          border-radius: 12px;
          padding: 9px;
          background: var(--white);
          text-align: left;
          transition: border-color .18s ease, background .18s ease, transform .18s ease;
        }

        .login-quick-button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(58, 170, 53, 0.26);
          background: var(--gray-50);
        }

        .login-quick-button:disabled {
          cursor: not-allowed;
          opacity: 0.66;
        }

        .login-quick-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: var(--gray-50);
          flex-shrink: 0;
        }

        .login-quick-copy {
          min-width: 0;
        }

        .login-quick-title {
          display: block;
          color: var(--gray-800);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.2;
        }

        .login-quick-subtitle {
          display: block;
          margin-top: 2px;
          color: var(--gray-500);
          font-size: 10px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .login-quick-divider {
          height: 1px;
          background: var(--gray-100);
          margin: 2px 0;
        }

        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 920px) {
          .login-page {
            padding: 24px;
            align-items: flex-start;
            overflow-y: auto;
          }

          .login-shell {
            min-height: auto;
            grid-template-columns: 1fr;
            width: min(100%, 720px);
          }

          .login-brand-panel {
            display: none;
          }

          .login-mobile-brand {
            display: flex;
          }

          .login-card {
            padding: 38px;
          }

          .login-quick-access {
            position: static;
            width: min(100%, 720px);
            margin-top: 16px;
          }
        }

        @media (max-width: 520px) {
          .login-page {
            padding: 16px;
          }

          .login-shell {
            border-radius: 20px;
          }

          .login-card {
            padding: 28px 20px;
          }

          .login-heading h2 {
            font-size: 24px;
          }

          .login-label-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
          }

          .login-create-account {
            flex-direction: column;
            gap: 4px;
            text-align: center;
          }

          .login-quick-access {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function QuickAccessButton({
  icon: Icon,
  title,
  subtitle,
  color,
  disabled,
  onClick,
}: {
  icon: ElementType;
  title: string;
  subtitle: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="login-quick-button" disabled={disabled} onClick={onClick}>
      <span className="login-quick-icon" style={{ color }} aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="login-quick-copy">
        <span className="login-quick-title">{title}</span>
        <span className="login-quick-subtitle">{subtitle}</span>
      </span>
    </button>
  );
}
