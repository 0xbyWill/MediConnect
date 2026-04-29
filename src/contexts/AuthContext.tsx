import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, doctorsApi, patientsApi, usersApi } from '../lib/api';
import type { ApiUser, ApiUserInfo } from '../lib/api';
import type { AuthUser, UserRole } from '../types';

// ─── Tipos do contexto ────────────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const KEYS = {
  token:   'mc_access_token',
  refresh: 'mc_refresh_token',
  user:    'mc_user',
};

// ─── Normaliza role da API para role interna ──────────────────────────────────
function normalizeRole(role?: string): UserRole {
  const r = role?.toLowerCase().trim();
  if (r === 'medico' || r === 'doctor' || r === 'physician') return 'medico';
  if (r === 'secretaria' || r === 'secretary' || r === 'receptionist') return 'secretaria';
  if (r === 'paciente' || r === 'patient') return 'paciente';
  // gestor, admin, gestao, manager → gestao
  return 'gestao';
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPatientId(apiUser: ApiUser, info?: ApiUserInfo | null): string | undefined {
  return (
    readString(info?.profile?.patient_id) ??
    readString(info?.user?.patient_id) ??
    readString(apiUser.user_metadata?.patient_id) ??
    readString(apiUser.app_metadata?.patient_id)
  );
}

function readApiRole(apiUser: ApiUser, info?: ApiUserInfo | null): UserRole | undefined {
  const role =
    info?.roles?.[0] ??
    info?.role ??
    info?.profile?.role ??
    info?.user?.roles?.[0] ??
    apiUser.user_metadata?.role ??
    apiUser.user_metadata?.roles?.[0] ??
    apiUser.app_metadata?.role ??
    apiUser.app_metadata?.roles?.[0];
  return role ? normalizeRole(role) : undefined;
}

// ─── Busca doctor_id cruzando e-mail com tabela doctors ──────────────────────
async function findDoctorByEmail(email: string) {
  try {
    const doctors = await doctorsApi.list({ active: true });
    const emailLower = email.toLowerCase().trim();
    return doctors.find(d => d.email?.toLowerCase().trim() === emailLower) ?? null;
  } catch {
    return null;
  }
}

async function findPatientByEmail(email: string) {
  try {
    const patients = await patientsApi.list({ email: email.toLowerCase().trim(), limit: 1 });
    return patients[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Resolve perfil completo do usuário ──────────────────────────────────────
async function resolveUserProfile(apiUser: ApiUser): Promise<AuthUser> {
  const info = await usersApi.currentInfo().catch(() => null);
  const explicitRole = readApiRole(apiUser, info);
  const explicitPatientId = readPatientId(apiUser, info);
  const fullName =
    info?.profile?.full_name ??
    info?.profile?.name ??
    info?.user?.full_name ??
    info?.user?.name ??
    apiUser.user_metadata?.full_name ??
    apiUser.user_metadata?.name ??
    apiUser.email.split('@')[0];

  if (explicitRole === 'paciente') {
    const patient = explicitPatientId ? null : await findPatientByEmail(apiUser.email);
    return {
      id:         apiUser.id,
      email:      apiUser.email,
      role:       'paciente',
      full_name:  patient?.full_name ?? fullName,
      patient_id: explicitPatientId ?? patient?.id,
    };
  }

  // ── CASO 1: role explícita e NÃO é médico → retorna sem buscar doctors ──
  if (explicitRole && explicitRole !== 'medico') {
    return {
      id:        apiUser.id,
      email:     apiUser.email,
      role:      explicitRole,
      full_name: fullName,
    };
  }

  // ── CASO 2: role é médico (explícita ou possível) → busca sempre doctor_id ──
  // Isso corrige o problema principal: o médico fica sem doctor_id
  const doctor = await findDoctorByEmail(apiUser.email);

  if (doctor) {
    return {
      id:        apiUser.id,
      email:     apiUser.email,
      role:      'medico',
      full_name: doctor.full_name,
      specialty: doctor.specialty,
      crm:       `${doctor.crm}/${doctor.crm_uf}`,
      doctor_id: doctor.id,   // ← CAMPO CRÍTICO: resolve o vazio das listas
    };
  }

  // ── CASO 3: não achou na tabela doctors → usa role explícita ou gestao ──
  return {
    id:        apiUser.id,
    email:     apiUser.email,
    role:      explicitRole ?? 'secretaria',
    full_name: fullName,
  };
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function tryLogin(email: string, password: string): Promise<AuthUser> {
  const session = await authApi.login(email.trim(), password);
  localStorage.setItem(KEYS.token,   session.access_token);
  localStorage.setItem(KEYS.refresh, session.refresh_token);
  // Busca dados frescos do usuário autenticado
  const currentUser = await authApi.getUser().catch(() => session.user);
  return resolveUserProfile({ ...session.user, ...currentUser });
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Restaura sessão e atualiza perfil na montagem
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const raw   = localStorage.getItem(KEYS.user);
      const token = localStorage.getItem(KEYS.token);

      if (raw && token) {
        try {
          // Exibe dados cacheados imediatamente (UX rápida)
          const cached = JSON.parse(raw) as AuthUser;
          if (!cancelled) setUser(cached);

          // Atualiza em background com dados frescos da API
          const freshApiUser = await authApi.getUser();
          const freshProfile = await resolveUserProfile(freshApiUser);

          if (!cancelled) {
            localStorage.setItem(KEYS.user, JSON.stringify(freshProfile));
            setUser(freshProfile);
          }
        } catch {
          // Token inválido/expirado → força logout
          localStorage.removeItem(KEYS.token);
          localStorage.removeItem(KEYS.refresh);
          localStorage.removeItem(KEYS.user);
        }
      }

      if (!cancelled) setLoading(false);
    };

    void restoreSession();
    return () => { cancelled = true; };
  }, []);

  // Força atualização do perfil (útil após criar usuário, mudar dados etc.)
  const refreshUser = useCallback(async () => {
    try {
      const freshApiUser = await authApi.getUser();
      const freshProfile = await resolveUserProfile(freshApiUser);
      localStorage.setItem(KEYS.user, JSON.stringify(freshProfile));
      setUser(freshProfile);
    } catch { /* silencioso */ }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const profile = await tryLogin(email, password);
      localStorage.setItem(KEYS.user, JSON.stringify(profile));
      setUser(profile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login';
      if (msg.includes('Invalid login') || msg.includes('invalid_grant')) {
        setError('E-mail ou senha incorretos.');
      } else if (msg.includes('Email not confirmed')) {
        setError('E-mail ainda não confirmado. Verifique sua caixa de entrada.');
      } else if (msg.includes('Too many requests')) {
        setError('Muitas tentativas. Aguarde alguns minutos.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignora */ }
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.refresh);
    localStorage.removeItem(KEYS.user);
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, clearError, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
