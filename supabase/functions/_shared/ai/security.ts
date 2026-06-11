const MAX_TEXT = 8000;
// Lista de origens permitidas (separadas por vírgula). Em produção, defina
// CORS_ALLOWED_ORIGIN com o domínio do app (ex.: https://app.vercel.app).
// Use "*" para refletir qualquer origem (seguro aqui pois as funções exigem
// Bearer token e não usam cookies). Quando não configurado, refletimos a
// origem da requisição para evitar que o front caia no fallback inseguro.
const CORS_ALLOWED_ORIGINS = (Deno.env.get('CORS_ALLOWED_ORIGIN') ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function resolveCorsOrigin(req?: Request): string {
  const requestOrigin = req?.headers.get('origin') ?? '';
  if (CORS_ALLOWED_ORIGINS.length === 0) return requestOrigin || '*';
  if (CORS_ALLOWED_ORIGINS.includes('*')) return requestOrigin || '*';
  if (requestOrigin && CORS_ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return CORS_ALLOWED_ORIGINS[0];
}

const SECRET_PATTERNS = [
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\b/g,
  /\b(sk|pk|rk|xoxb|ghp|github_pat)_[A-Za-z0-9_=-]{16,}\b/gi,
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
];

export function jsonResponse(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': resolveCorsOrigin(req),
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,OPTIONS',
      'vary': 'Origin',
    },
  });
}

export async function readJson<T>(req: Request): Promise<T> {
  if (req.method === 'GET') return {} as T;
  const body = await req.text();
  if (!body.trim()) return {} as T;
  return JSON.parse(body) as T;
}

export function sanitizeText(value: unknown, max = MAX_TEXT) {
  const raw = typeof value === 'string' ? value : '';
  return maskSensitive(raw.replace(/\0/g, '').trim()).slice(0, max);
}

export function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  return JSON.parse(JSON.stringify(payload, (_key, value) => {
    if (typeof value === 'string') return sanitizeText(value);
    return value;
  })) as T;
}

export function maskSensitive(text: string) {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[dado mascarado]'), text);
}

export function validateSafeInstruction(content: string) {
  const lower = content.toLowerCase();
  const blocked = [
    'ignore regras',
    'ignorar regras',
    'revele prompt',
    'mostrar prompt',
    'expor token',
    'expor senha',
    'dados sensiveis',
    'sem permissao',
  ];
  if (blocked.some(term => lower.includes(term))) {
    throw new Error('Instrucao bloqueada por tentar sobrescrever regras de seguranca ou expor dados sensiveis.');
  }
}

export async function requireUser(supabase: SupabaseClientLike) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error('Usuario nao autenticado.');
  return data.user as SupabaseUser;
}

export async function requireAdmin(supabase: SupabaseClientLike) {
  const user = await requireUser(supabase);
  const { data: profile } = await supabase
    .from('profiles')
    .select('role,active,disabled')
    .or(`id.eq.${user.id},user_id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();
  const metadataRole = String(user.app_metadata?.role ?? user.user_metadata?.role ?? '').toLowerCase();
  const role = String(profile?.role ?? metadataRole).toLowerCase();
  const active = profile?.active !== false && profile?.disabled !== true;
  if (!active || !['admin', 'gestor', 'gestao', 'manager'].includes(role)) {
    throw new Error('Permissao administrativa obrigatoria.');
  }
  return user;
}
import type { SupabaseClientLike, SupabaseUser } from './repository.ts';
