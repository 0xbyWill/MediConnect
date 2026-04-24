import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, doctorsApi } from '../lib/api';
import type { ApiUser } from '../lib/api';
import type { AuthUser, UserRole } from '../types';

// ─── Tipos do contexto ────────────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const KEYS = {
  token:   'mc_access_token',
  refresh: 'mc_refresh_token',
  user:    'mc_user',
};

// ─────────────────────────────────────────────────────────────────────────────
// USUÁRIOS MOCK — apenas para testes locais em desenvolvimento
// Remova ou comente este bloco quando for para produção
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_USERS: Record<string, { password: string; profile: AuthUser }> = {
  'medico@mediconnect.com': {
    password: 'medico123',
    profile: {
      id:        'mock-medico-001',
      email:     'medico@mediconnect.com',
      role:      'medico',
      full_name: 'Dr. João Silva',
      specialty: 'Cardiologista',
      crm:       'CRM/SP 123456',
      doctor_id: 'mock-doctor-001',
    },
  },
  'gestao@mediconnect.com': {
    password: 'gestao123',
    profile: {
      id:        'mock-gestao-001',
      email:     'gestao@mediconnect.com',
      role:      'gestao',
      full_name: 'Ana Coordenadora',
      specialty: undefined,
    },
  },
  'secretaria@mediconnect.com': {
    password: 'secretaria123',
    profile: {
      id:        'mock-secretaria-001',
      email:     'secretaria@mediconnect.com',
      role:      'secretaria',
      full_name: 'Maria Secretária',
      specialty: undefined,
    },
  },
};

// ─── Tenta login mock primeiro, depois API real ───────────────────────────────
async function tryLogin(email: string, password: string): Promise<AuthUser> {
  // 1. Verifica se é um usuário mock de teste
  const mock = MOCK_USERS[email.toLowerCase()];
  if (mock) {
    if (mock.password !== password) {
      throw new Error('E-mail ou senha incorretos.');
    }
    return mock.profile;
  }

  // 2. Senão, tenta login real na API
  const session = await authApi.login(email, password);
  localStorage.setItem(KEYS.token,   session.access_token);
  localStorage.setItem(KEYS.refresh, session.refresh_token);
  return resolveUserProfile(session.user);
}

// ─── Resolve perfil do usuário real da API ───────────────────────────────────
async function resolveUserProfile(apiUser: ApiUser): Promise<AuthUser> {
  try {
    const doctors = await doctorsApi.list({ active: true });
    const emailPrefix = apiUser.email.split('@')[0].toLowerCase();
    const doctor = doctors.find(d =>
      d.full_name.toLowerCase().replace(/\s+/g, '').includes(emailPrefix) ||
      emailPrefix.includes(d.full_name.split(' ')[0].toLowerCase())
    );
    if (doctor) {
      return {
        id:        apiUser.id,
        email:     apiUser.email,
        role:      'medico' as UserRole,
        full_name: doctor.full_name,
        specialty: doctor.specialty,
        crm:       `${doctor.crm}/${doctor.crm_uf}`,
        doctor_id: doctor.id,
      };
    }
  } catch {
    // ignora erro e usa fallback
  }
  return {
    id:        apiUser.id,
    email:     apiUser.email,
    role:      'gestao' as UserRole,
    full_name: apiUser.email.split('@')[0],
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const raw   = localStorage.getItem(KEYS.user);
    const token = localStorage.getItem(KEYS.token);
    if (raw && token) {
      try { setUser(JSON.parse(raw) as AuthUser); }
      catch { localStorage.removeItem(KEYS.user); }
    } else if (raw) {
      // sessão mock (sem token de API)
      try { setUser(JSON.parse(raw) as AuthUser); }
      catch { localStorage.removeItem(KEYS.user); }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const profile = await tryLogin(email, password);
      localStorage.setItem(KEYS.user, JSON.stringify(profile));
      // mock users não têm token real — usamos um placeholder
      if (!localStorage.getItem(KEYS.token)) {
        localStorage.setItem(KEYS.token, 'mock-token-' + profile.id);
      }
      setUser(profile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login';
      if (msg.includes('Invalid login') || msg.includes('invalid_grant')) {
        setError('E-mail ou senha incorretos.');
      } else if (msg.includes('Email not confirmed')) {
        setError('E-mail ainda não confirmado. Verifique sua caixa de entrada.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(KEYS.token) ?? '';
    if (!token.startsWith('mock-token-')) {
      try { await authApi.logout(); } catch { /* ignora */ }
    }
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.refresh);
    localStorage.removeItem(KEYS.user);
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}