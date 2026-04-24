import { useState } from 'react';
import type { FormEvent } from 'react';
import { Heart, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, loading, error, clearError } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email.trim(), password);
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}