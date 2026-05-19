import { appEnv } from '../config/env';

const BASE_URL = appEnv.supabaseUrl;
const ANON_KEY = appEnv.supabaseAnonKey;

function getToken(): string | null {
  return localStorage.getItem('mc_access_token');
}

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  const bearer = token ?? ANON_KEY;
  return {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${bearer}`,
    ...extra,
  };
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(extraHeaders),
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const apiError = err as {
      message?: string;
      msg?: string;
      error?: string;
      error_description?: string;
      detail?: string;
      details?: string;
      hint?: string;
    };
    const message =
      apiError.message ||
      apiError.msg ||
      apiError.error_description ||
      apiError.error ||
      apiError.detail ||
      apiError.details ||
      apiError.hint ||
      res.statusText ||
      'Erro na requisição';
    throw new Error(`${message} (${res.status})`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function buildUrl(path: string): string {
  const base = new URL(BASE_URL);
  const url = new URL(path, `${BASE_URL}/`);
  if (url.origin !== base.origin) {
    throw new Error('Destino de API externo bloqueado para evitar vazamento de credenciais.');
  }
  return url.toString();
}
