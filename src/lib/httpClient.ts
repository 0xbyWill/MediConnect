const BASE_URL = 'https://yuanqfswhberkoevtmfr.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YW5xZnN3aGJlcmtvZXZ0bWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NTQzNjksImV4cCI6MjA3MDUzMDM2OX0.g8Fm4XAvtX46zifBZnYVH4tVuQkqUH6Ia9CXQj4DztQ';

function getToken(): string | null {
  return localStorage.getItem('mc_access_token');
}

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
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
      details?: string;
      hint?: string;
    };
    throw new Error(
      apiError.message ||
      apiError.msg ||
      apiError.error_description ||
      apiError.error ||
      apiError.details ||
      apiError.hint ||
      `Erro na requisicao (${res.status})`
    );
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}
