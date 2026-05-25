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

export interface ApiProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

export class ApiRequestError extends Error {
  status: number;
  problem?: ApiProblemDetails;

  constructor(message: string, status: number, problem?: ApiProblemDetails) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.problem = problem;
  }
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProblemErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isStringRecord(value)) return undefined;
  const entries = Object.entries(value)
    .map(([field, messages]) => {
      if (Array.isArray(messages)) {
        const normalized = messages.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        return normalized.length ? [field, normalized] as const : null;
      }
      if (typeof messages === 'string' && messages.trim()) return [field, [messages.trim()]] as const;
      return null;
    })
    .filter((entry): entry is readonly [string, string[]] => Boolean(entry));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function toProblemDetails(body: unknown, fallbackStatus: number): ApiProblemDetails | undefined {
  if (!isStringRecord(body)) return undefined;
  const problem: ApiProblemDetails = {
    type: typeof body.type === 'string' ? body.type : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    status: typeof body.status === 'number' ? body.status : fallbackStatus,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
    errors: normalizeProblemErrors(body.errors),
  };
  return problem.type || problem.title || problem.detail || problem.errors ? problem : undefined;
}

function legacyErrorMessage(body: unknown): string | undefined {
  if (!isStringRecord(body)) return undefined;
  return [
    body.message,
    body.msg,
    body.error_description,
    body.error,
    body.detail,
    body.details,
    body.hint,
  ].find((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function problemMessage(problem: ApiProblemDetails, fallback: string) {
  const fieldMessages = problem.errors
    ? Object.entries(problem.errors)
        .flatMap(([field, messages]) => messages.map(message => `${field}: ${message}`))
        .join(' ')
    : '';
  return [problem.title, problem.detail, fieldMessages].filter(Boolean).join(' - ') || fallback;
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
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const problem = toProblemDetails(body, res.status);
    const fallback = legacyErrorMessage(body) || res.statusText || 'Erro na requisicao';
    const message = problem ? problemMessage(problem, fallback) : fallback;
    throw new ApiRequestError(`${message} (${res.status})`, res.status, problem);
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
