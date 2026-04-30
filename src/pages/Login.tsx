import { useState } from 'react';
import type { FormEvent } from 'react';
import { Heart, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, Shield, Stethoscope, UserRound, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onCreateAccount?: () => void;
}

export default function Login({ onCreateAccount }: LoginProps) {
  const { login, loginMockPatient, loading, error, clearError } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email.trim(), password);
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
    <div style={{
      minHeight: '100dvh', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--darker) 0%, var(--dark) 55%, #2d8a45 100%)',
      padding: 24,
    }}>
      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#fff', borderRadius: 24,
        padding: '40px 36px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--primary), var(--dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(58,170,53,0.35)', marginBottom: 14,
          }}>
            <Heart size={26} color="#fff" fill="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--dark)', letterSpacing: -0.5 }}>
            MediConnect
          </h1>
          <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Clinical Sanctuary
          </p>
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 4 }}>
          Bem-vindo de volta
        </h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 28 }}>
          Acesse o sistema com suas credenciais
        </p>

        {/* Erro */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'var(--red-50)', border: '1px solid var(--red-100)',
            borderRadius: 10, padding: '12px 14px', marginBottom: 20,
          }}>
            <AlertCircle size={16} color="var(--red-500)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--red-600)' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* E-mail */}
          <div>
            <label style={{
              fontSize: 11, fontWeight: 700, color: 'var(--gray-600)',
              textTransform: 'uppercase', letterSpacing: 0.6,
              display: 'block', marginBottom: 6,
            }}>
              E-mail
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{
                position: 'absolute', left: 13, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--gray-400)',
              }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                style={{
                  width: '100%', padding: '11px 14px 11px 38px',
                  border: '1px solid var(--gray-200)', borderRadius: 10,
                  fontSize: 13, outline: 'none', background: 'var(--gray-50)',
                  color: 'var(--gray-800)', transition: 'border .15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e  => { e.target.style.borderColor = 'var(--gray-200)'; }}
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label style={{
              fontSize: 11, fontWeight: 700, color: 'var(--gray-600)',
              textTransform: 'uppercase', letterSpacing: 0.6,
              display: 'block', marginBottom: 6,
            }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{
                position: 'absolute', left: 13, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--gray-400)',
              }} />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '11px 40px 11px 38px',
                  border: '1px solid var(--gray-200)', borderRadius: 10,
                  fontSize: 13, outline: 'none', background: 'var(--gray-50)',
                  color: 'var(--gray-800)', transition: 'border .15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; }}
                onBlur={e  => { e.target.style.borderColor = 'var(--gray-200)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute', right: 13, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--gray-400)', display: 'flex',
                }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Esqueci senha */}
          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <button
              type="button"
              style={{
                background: 'none', border: 'none',
                fontSize: 12, color: 'var(--primary)',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              Esqueci minha senha
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading
                ? 'var(--gray-300)'
                : 'linear-gradient(135deg, var(--primary), var(--dark))',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: loading ? 'none' : '0 4px 14px rgba(58,170,53,0.35)',
              transition: 'all .2s',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Entrando...
              </>
            ) : 'Entrar no Sistema'}
          </button>
        </form>

        {onCreateAccount && (
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Ainda não tem conta? </span>
            <button
              type="button"
              onClick={onCreateAccount}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Criar conta
            </button>
          </div>
        )}

        {/* Info de perfis */}
        <div style={{
          marginTop: 28, padding: 16,
          background: 'var(--gray-50)', borderRadius: 10,
          border: '1px solid var(--gray-100)',
        }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: 'var(--gray-500)',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
          }}>
            Perfis disponíveis
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { role: 'Médico',     desc: 'Prontuários, laudos e agenda própria', color: 'var(--primary)' },
              { role: 'Gestão',     desc: 'Acesso completo ao sistema',           color: '#7c3aed' },
              { role: 'Secretaria', desc: 'Agendamentos e cadastro de pacientes', color: 'var(--amber-600)' },
              { role: 'Paciente',   desc: 'Consultas e laudos do próprio perfil', color: '#2563eb' },
            ].map(p => (
              <div key={p.role} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: p.color, flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                  <strong>{p.role}</strong> — {p.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-400)', marginTop: 24 }}>
          MediConnect © {new Date().getFullYear()} · Clinical Sanctuary
        </p>
      </div>

      <div style={{ position: 'fixed', right: 18, bottom: 18, width: 'min(280px, calc(100vw - 36px))', background: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: 14, boxShadow: '0 14px 36px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.35)', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5 }}>
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--dark)', margin: 0 }}>Acessos rapidos</h2>
          <p style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 2 }}>Atalhos de teste</p>
        </div>

        <QuickAccessButton icon={Stethoscope} title="Médico" subtitle="Agenda, pacientes, laudos e relatórios" color="var(--primary)" disabled={loading} onClick={() => void quickLogin({ email: 'joao.francisco777@gmail.com', password: 'Teste@123' })} />
        <QuickAccessButton icon={ClipboardList} title="Secretaria" subtitle="Agenda, pacientes e comunicação" color="var(--amber-600)" disabled={loading} onClick={() => void quickLogin({ email: 'isabely.santiny777@gmail.com', password: 'Teste@123' })} />
        <QuickAccessButton icon={Shield} title="Gestor" subtitle="Acesso administrativo completo" color="#7c3aed" disabled={loading} onClick={() => void quickLogin({ email: 'hugo@popcode.com.br', password: 'hdoria' })} />

        <div style={{ height: 1, background: 'var(--gray-100)', margin: '2px 0' }} />

        <button type="button" disabled={loading} onClick={demoPatient}
          style={{ width: '100%', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: loading ? 'not-allowed' : 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserRound size={14} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8' }}>Paciente mockado</div>
            <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>Ver permissoes</div>
          </div>
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{ width: '100%', border: '1px solid var(--gray-100)', background: '#fff', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--gray-50)', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-800)' }}>{title}</div>
        <div style={{ fontSize: 9, color: 'var(--gray-500)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
      </div>
    </button>
  );
}
