// ─── Configuração Base ────────────────────────────────────────────────────────
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

async function request<T>(
  path: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(extraHeaders),
      ...(options.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string; error_description?: string })?.message ||
      (err as { error_description?: string })?.error_description ||
      'Erro na requisição'
    );
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ─── Tipos da API ─────────────────────────────────────────────────────────────
export interface ApiUser {
  id: string;
  email: string;
  created_at?: string;
}

export interface ApiSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: ApiUser;
}

export interface ApiDoctor {
  id: string;
  full_name: string;
  crm: string;
  crm_uf: string;
  specialty: string;
  active?: boolean;
}

export interface ApiPatient {
  id: string;
  full_name: string;
  cpf: string;
  email: string;
  phone_mobile: string;
  birth_date?: string;
  avatar_url?: string;
  health_insurance?: string;
  status?: string;
  etnia?: string;
  raca?: string;
}

export interface ApiAppointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_at: string;
  duration_minutes?: number;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  created_by?: string;
  notes?: string;
  type?: string;
}

export interface ApiReport {
  id: string;
  order_number?: string;
  patient_id: string;
  status: 'draft' | 'completed';
  exam?: string;
  requested_by?: string;
  cid_code?: string;
  diagnosis?: string;
  conclusion?: string;
  content_html?: string;
  hide_date?: boolean;
  hide_signature?: boolean;
  due_at?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<ApiSession>('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<void>('/auth/v1/logout', { method: 'POST' }),

  getUser: () =>
    request<ApiUser>('/auth/v1/user'),
};

// ─── Médicos ──────────────────────────────────────────────────────────────────
export const doctorsApi = {
  list: (params: { active?: boolean; specialty?: string } = {}) => {
    const q = new URLSearchParams({ select: '*' });
    if (params.active !== undefined) q.set('active', `eq.${params.active}`);
    if (params.specialty) q.set('specialty', `eq.${params.specialty}`);
    return request<ApiDoctor[]>(`/rest/v1/doctors?${q.toString()}`);
  },
};

// ─── Pacientes ────────────────────────────────────────────────────────────────
export const patientsApi = {
  list: (params: { search?: string; cpf?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams({ select: '*', order: 'full_name.asc' });
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    if (params.cpf) q.set('cpf', `eq.${params.cpf}`);
    if (params.search) q.set('full_name', `ilike.*${params.search}*`);
    return request<ApiPatient[]>(`/rest/v1/patients?${q.toString()}`);
  },

  create: (data: Omit<ApiPatient, 'id'>) =>
    request<ApiPatient>('/functions/v1/create-patient', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<ApiPatient>) =>
    request<ApiPatient>(`/rest/v1/patients?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }),

  delete: (id: string) =>
    request<void>(`/rest/v1/patients?id=eq.${id}`, { method: 'DELETE' }),
};

// ─── Agendamentos ─────────────────────────────────────────────────────────────
export const appointmentsApi = {
  list: (params: { doctor_id?: string; patient_id?: string; status?: string } = {}) => {
    const q = new URLSearchParams({ select: '*', order: 'scheduled_at.asc' });
    if (params.doctor_id) q.set('doctor_id', `eq.${params.doctor_id}`);
    if (params.patient_id) q.set('patient_id', `eq.${params.patient_id}`);
    if (params.status) q.set('status', `eq.${params.status}`);
    return request<ApiAppointment[]>(`/rest/v1/appointments?${q.toString()}`);
  },

  create: (data: Omit<ApiAppointment, 'id'>) =>
    request<ApiAppointment>('/rest/v1/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }),

  update: (id: string, data: Partial<ApiAppointment>) =>
    request<ApiAppointment>(`/rest/v1/appointments?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }),

  delete: (id: string) =>
    request<void>(`/rest/v1/appointments?id=eq.${id}`, { method: 'DELETE' }),
};

// ─── Laudos / Reports ─────────────────────────────────────────────────────────
export const reportsApi = {
  list: (params: { patient_id?: string; status?: string; created_by?: string } = {}) => {
    const q = new URLSearchParams({ order: 'created_at.desc' });
    if (params.patient_id) q.set('patient_id', `eq.${params.patient_id}`);
    if (params.status) q.set('status', `eq.${params.status}`);
    if (params.created_by) q.set('created_by', `eq.${params.created_by}`);
    return request<ApiReport[]>(`/rest/v1/reports?${q.toString()}`);
  },

  create: (data: Omit<ApiReport, 'id' | 'order_number' | 'created_at' | 'updated_at'>) =>
    request<ApiReport>('/rest/v1/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }),

  update: (id: string, data: Partial<ApiReport>) =>
    request<ApiReport>(`/rest/v1/reports?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }),

  delete: (id: string) =>
    request<void>(`/rest/v1/reports?id=eq.${id}`, { method: 'DELETE' }),
};