import { useState } from 'react';
import type { ElementType, FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onCreateAccount?: () => void;
}

const PROJECT_MARK_SRC = '/mediconnect-mark.png';

export default function Login({ onCreateAccount }: LoginProps) {
  const { login, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

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

  return (
    <main className="login-page" aria-labelledby="login-title">
      <div className="auth-background" aria-hidden="true">
        <span className="pulse-orb pulse-orb-primary" />
        <span className="pulse-orb pulse-orb-secondary" />
        <svg className="heartbeat-line" viewBox="0 0 1200 240" preserveAspectRatio="none" focusable="false">
          <path
            d="M0 128H204L240 128L270 128L300 42L344 206L390 128H482L520 128L552 128L586 82L632 166L670 128H776L812 128L844 128L880 34L934 216L982 128H1200"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <section className="login-shell">
        <div className="login-left">
          <header className="login-logo-row" aria-label="MediConnect">
            <span className="login-logo-mark" aria-hidden="true">
              <img src={PROJECT_MARK_SRC} alt="" />
            </span>
            <span className="login-brand-copy">
              <span className="login-brand-name">MediConnect</span>
              <span className="login-brand-caption">Gestao Inteligente de Saude</span>
            </span>
          </header>

          <div className="login-card" aria-label="Entrada no sistema">
            <div className="login-heading">
              <h1 id="login-title">Bem-vindo de volta</h1>
              <p>Faca login para acessar sua conta</p>
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
                  <Mail size={20} aria-hidden="true" />
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
                <label htmlFor="login-password">Senha</label>
                <div className="login-input-wrap">
                  <Lock size={20} aria-hidden="true" />
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

              <div className="login-form-row">
                <label className="login-remember" htmlFor="login-remember">
                  <input
                    id="login-remember"
                    type="checkbox"
                    checked={remember}
                    onChange={event => setRemember(event.target.checked)}
                  />
                  <span>Lembrar-me</span>
                </label>
                <button type="button" className="login-forgot-button">
                  Esqueceu a senha?
                </button>
              </div>

              <button type="submit" className="login-submit" disabled={!canSubmit} aria-busy={loading}>
                {loading ? (
                  <>
                    <Loader2 size={18} className="login-spinner" aria-hidden="true" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Fazer Login
                    <ArrowRight size={19} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            {onCreateAccount && (
              <div className="login-create-account">
                <span>Nao tem uma conta?</span>
                <button type="button" onClick={onCreateAccount}>
                  Criar Conta
                </button>
              </div>
            )}
          </div>

        </div>

        <div className="login-hero" aria-label="Resumo da plataforma">
          <div className="login-hero-copy">
            <h2>MediConnect</h2>
            <p>Prontuarios digitais, agendamento inteligente e muito mais em uma unica plataforma</p>
          </div>

          <div className="login-benefits" aria-label="Recursos principais">
            <FeatureItem icon={Stethoscope} title="Atendimento" subtitle="Completo e eficiente" />
            <FeatureItem icon={UsersRound} title="Pacientes" subtitle="Gestao centralizada" />
            <FeatureItem icon={ShieldCheck} title="Seguranca" subtitle="Dados protegidos" />
          </div>
        </div>
      </section>

      <footer className="login-footer">&copy; 2026 MediConnect. Todos os direitos reservados.</footer>

      <aside className="login-quick-access" aria-label="Acessos rapidos">
        <div className="login-quick-header">
          <h2>Acessos rapidos</h2>
          <p>Ambiente de teste</p>
        </div>

        <QuickAccessButton
          icon={Stethoscope}
          title="Medico"
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
          onClick={() => void quickLogin({ email: 'bobesponja@popcode.com', password: 'Teste@123' })}
        />
      </aside>

      <style>{`
        .login-page {
          --heartbeat-duration: 5.2s;
          width: 100%;
          min-height: 100dvh;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 42px 40px 54px;
          background:
            radial-gradient(circle at 55% 50%, rgba(0, 166, 63, 0.28) 0, rgba(117, 231, 157, 0.34) 25%, rgba(221, 251, 233, 0.54) 42%, transparent 58%),
            radial-gradient(circle at 74% 3%, rgba(220, 252, 231, 0.84) 0, transparent 28%),
            linear-gradient(105deg, #fbfefc 0%, #f4fcf8 30%, #e7f9ef 56%, #f9fffb 100%);
          overflow-x: hidden;
          overflow-y: auto;
        }

        .login-page::before {
          content: '';
          position: absolute;
          width: min(78vw, 900px);
          height: min(78vw, 900px);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) scale(1);
          background:
            radial-gradient(circle at 43% 37%, rgba(0, 166, 63, 0.30), transparent 26%),
            radial-gradient(circle at 62% 42%, rgba(0, 158, 87, 0.30), transparent 31%);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(1px);
          opacity: 0.78;
          transform-origin: center;
          animation: pulseHeartCentered var(--heartbeat-duration) ease-in-out infinite;
        }

        .auth-background {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .pulse-orb {
          position: absolute;
          display: block;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(0, 166, 63, 0.28) 0, rgba(117, 231, 157, 0.18) 32%, rgba(255, 255, 255, 0.04) 52%, transparent 70%);
          filter: blur(0.5px);
          transform: translate3d(0, 0, 0) scale(1);
          opacity: 0.68;
          animation: pulseHeart var(--heartbeat-duration) ease-in-out infinite;
        }

        .pulse-orb-primary {
          width: min(58vw, 700px);
          height: min(58vw, 700px);
          left: 33%;
          top: 16%;
        }

        .pulse-orb-secondary {
          width: min(38vw, 430px);
          height: min(38vw, 430px);
          right: 7%;
          bottom: 6%;
          opacity: 0.34;
          animation-delay: calc(var(--heartbeat-duration) * 0.5);
        }

        .heartbeat-line {
          position: absolute;
          left: -8%;
          top: 52%;
          width: 116%;
          height: min(30vw, 280px);
          color: rgba(0, 126, 66, 0.18);
          filter: drop-shadow(0 16px 26px rgba(0, 166, 63, 0.12));
          transform: translate3d(0, -50%, 0);
        }

        .heartbeat-line path {
          stroke-dasharray: 1420;
          stroke-dashoffset: 1420;
          animation: ecgDraw var(--heartbeat-duration) ease-in-out infinite;
        }

        .login-shell {
          position: relative;
          z-index: 1;
          width: min(100%, 1120px);
          min-height: 680px;
          display: grid;
          grid-template-columns: minmax(360px, 448px) minmax(440px, 1fr);
          column-gap: 72px;
          align-items: center;
        }

        .login-left {
          min-width: 0;
        }

        .login-logo-row {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 52px;
        }

        .login-logo-mark {
          width: 48px;
          height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid rgba(0, 166, 63, 0.16);
          box-shadow: 0 14px 26px rgba(0, 176, 91, 0.18);
          flex-shrink: 0;
          overflow: hidden;
          padding: 5px;
        }

        .login-logo-mark img {
          width: 220%;
          height: 220%;
          display: block;
          object-fit: contain;
        }

        .login-brand-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .login-brand-name {
          color: #111827;
          font-size: 30px;
          line-height: 1.08;
          font-weight: 800;
        }

        .login-brand-caption {
          margin-top: 12px;
          color: #475569;
          font-size: 14px;
          line-height: 1.25;
          font-weight: 500;
        }

        .login-card {
          width: 100%;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
        }

        .login-heading {
          margin-bottom: 32px;
        }

        .login-heading h1 {
          margin: 0;
          color: #111827;
          font-size: 30px;
          line-height: 1.18;
          font-weight: 800;
        }

        .login-heading p {
          margin-top: 8px;
          color: #475569;
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
          gap: 21px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .login-field label {
          color: #334155;
          font-size: 13px;
          font-weight: 800;
        }

        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .login-input-wrap > svg {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #9aa4b2;
          pointer-events: none;
          transition: color .18s ease;
        }

        .login-input-wrap input {
          width: 100%;
          min-height: 54px;
          border: 1.5px solid rgba(0, 166, 63, 0.26);
          border-radius: 12px;
          padding: 13px 48px 13px 49px;
          background: rgba(255, 255, 255, 0.92);
          color: #1f2937;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 1px 0 rgba(16, 185, 129, 0.04);
          transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
        }

        .login-input-wrap input::placeholder {
          color: #98a2b3;
          font-weight: 600;
        }

        .login-input-wrap:focus-within > svg {
          color: #00a957;
        }

        .login-input-wrap input:hover,
        .login-input-wrap input:focus {
          border-color: var(--primary);
          background: var(--white);
          box-shadow: 0 0 0 4px rgba(0, 166, 63, 0.16);
        }

        .login-input-wrap input:invalid:not(:placeholder-shown) {
          border-color: var(--red-500);
        }

        .login-password-toggle,
        .login-forgot-button,
        .login-create-account button {
          border: 0;
          background: transparent;
          color: #00a34f;
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
          line-height: 0;
          color: #97a3b3;
        }

        .login-password-toggle svg,
        .login-logo-mark svg,
        .login-feature-icon svg {
          display: block;
          flex-shrink: 0;
        }

        .login-password-toggle:hover {
          background: #dcfce7;
          color: #037a3f;
        }

        .login-form-row {
          min-height: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: -2px;
        }

        .login-remember {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
        }

        .login-remember input {
          width: 16px;
          height: 16px;
          border: 1px solid #9aa4b2;
          accent-color: #00b961;
          cursor: pointer;
        }

        .login-forgot-button {
          padding: 2px 0;
          font-size: 12px;
          white-space: nowrap;
        }

        .login-forgot-button:hover,
        .login-create-account button:hover {
          color: #047857;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .login-submit {
          min-height: 56px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(90deg, var(--primary) 0%, #008f5a 100%);
          color: var(--white);
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 16px 28px rgba(0, 176, 91, 0.25);
          transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
        }

        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 20px 34px rgba(0, 176, 91, 0.3);
          filter: saturate(1.04);
        }

        .login-submit:disabled {
          cursor: not-allowed;
          background: #a7d9b8;
          box-shadow: none;
        }

        .login-spinner {
          animation: login-spin 1s linear infinite;
        }

        .login-create-account {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin-top: 28px;
          color: #475569;
          font-size: 13px;
          font-weight: 600;
        }

        .login-create-account button {
          padding: 0;
          font-size: 13px;
        }

        .login-hero {
          min-width: 0;
          min-height: 620px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .login-hero-copy {
          max-width: 530px;
        }

        .login-hero-copy h2 {
          margin: 0;
          color: #063a2a;
          font-size: clamp(40px, 4vw, 50px);
          line-height: 0.96;
          font-weight: 800;
        }

        .login-hero-copy p {
          margin: 22px auto 0;
          max-width: 560px;
          color: #275741;
          font-size: 20px;
          line-height: 1.44;
          font-weight: 500;
        }

        .login-benefits {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 34px;
          margin-top: 64px;
          align-items: start;
          justify-items: center;
        }

        .login-feature {
          width: min(100%, 150px);
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .login-feature-icon {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
          border-radius: 14px;
          border: 1.5px solid #a7f3c4;
          background: rgba(255, 255, 255, 0.72);
          color: #00a957;
          box-shadow: 0 10px 18px rgba(15, 118, 75, 0.12);
        }

        .login-feature strong {
          display: block;
          margin-top: 18px;
          color: #0f172a;
          font-size: 17px;
          line-height: 1.2;
          font-weight: 800;
        }

        .login-feature-subtitle {
          display: block;
          margin-top: 8px;
          color: #475569;
          font-size: 14px;
          line-height: 1.35;
          font-weight: 500;
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

        .login-footer {
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

        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulseHeart {
          0%, 100% {
            opacity: 0.54;
            transform: translate3d(0, 0, 0) scale(0.98);
          }
          14% {
            opacity: 0.84;
            transform: translate3d(0, 0, 0) scale(1.04);
          }
          28% {
            opacity: 0.62;
            transform: translate3d(0, 0, 0) scale(1);
          }
          44% {
            opacity: 0.78;
            transform: translate3d(0, 0, 0) scale(1.025);
          }
        }

        @keyframes pulseHeartCentered {
          0%, 100% {
            opacity: 0.58;
            transform: translate(-50%, -50%) scale(0.98);
          }
          14% {
            opacity: 0.86;
            transform: translate(-50%, -50%) scale(1.04);
          }
          28% {
            opacity: 0.64;
            transform: translate(-50%, -50%) scale(1);
          }
          44% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1.025);
          }
        }

        @keyframes ecgDraw {
          0% {
            stroke-dashoffset: 1420;
            opacity: 0;
          }
          14% {
            opacity: 0.9;
          }
          44% {
            stroke-dashoffset: 0;
            opacity: 0.8;
          }
          100% {
            stroke-dashoffset: -1420;
            opacity: 0;
          }
        }

        @media (max-width: 1160px) {
          .login-page {
            padding: 30px 24px 54px;
          }

          .login-shell {
            column-gap: 36px;
            grid-template-columns: minmax(320px, 420px) minmax(380px, 1fr);
          }

          .login-quick-access {
            width: 252px;
          }
        }

        @media (max-width: 940px) {
          .login-page {
            align-items: flex-start;
            overflow-y: auto;
          }

          .login-shell {
            width: min(100%, 680px);
            min-height: auto;
            grid-template-columns: 1fr;
            gap: 42px;
          }

          .login-logo-row {
            margin-bottom: 36px;
          }

          .login-hero {
            order: -1;
            min-height: auto;
            padding-top: 0;
          }

          .login-hero-copy {
            margin-top: 0;
          }

          .login-hero-copy h2 {
            font-size: 38px;
            line-height: 1.04;
          }

          .login-hero-copy p {
            margin-top: 16px;
            font-size: 17px;
          }

          .login-benefits {
            gap: 16px;
            margin-top: 32px;
          }

          .login-quick-access {
            position: relative;
            right: auto;
            bottom: auto;
            width: min(100%, 680px);
            margin: 18px auto 0;
          }

          .login-footer {
            position: static;
            transform: none;
            margin-top: 20px;
          }
        }

        @media (max-width: 560px) {
          .login-page {
            padding: 22px 16px 28px;
          }

          .pulse-orb-secondary {
            display: none;
          }

          .heartbeat-line {
            top: 31%;
            width: 140%;
            left: -20%;
            opacity: 0.58;
          }

          .login-brand-name {
            font-size: 25px;
          }

          .login-brand-caption {
            margin-top: 8px;
          }

          .login-heading h1 {
            font-size: 26px;
          }

          .login-form-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .login-create-account {
            flex-wrap: wrap;
            text-align: center;
          }

          .login-hero-copy h2 {
            font-size: 32px;
          }

          .login-benefits {
            grid-template-columns: 1fr;
            gap: 22px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-page::before,
          .pulse-orb,
          .heartbeat-line path,
          .login-spinner {
            animation: none;
          }

          .heartbeat-line path {
            stroke-dashoffset: 0;
          }

          .login-submit,
          .login-quick-button,
          .login-input-wrap input,
          .login-input-wrap > svg {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="login-feature">
      <span className="login-feature-icon" aria-hidden="true">
        <Icon size={30} strokeWidth={2.3} />
      </span>
      <strong>{title}</strong>
      <span className="login-feature-subtitle">{subtitle}</span>
    </div>
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
