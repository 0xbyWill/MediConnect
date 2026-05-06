// ─── Configuração Base ────────────────────────────────────────────────────────
import { request } from './httpClient';

// ─── Tipos da API ─────────────────────────────────────────────────────────────
export interface ApiUser {
  id: string;
  email: string;
  created_at?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    role?: ApiRole;
    roles?: ApiRole[];
    phone?: string;
    patient_id?: string;
  };
  app_metadata?: {
    role?: ApiRole;
    roles?: ApiRole[];
    patient_id?: string;
  };
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
  email?: string;
  cpf?: string;
  crm: string;
  crm_uf: string;
  specialty: string;
  phone_mobile?: string;
  active?: boolean;
}

export type ApiRole = 'admin' | 'gestor' | 'secretaria' | 'medico' | 'paciente';

export interface CreateUserPayload {
  email: string;
  full_name: string;
  phone?: string;
  role: ApiRole;
  create_patient_record?: boolean;
  cpf?: string;
  phone_mobile?: string;
  crm?: string;
  crm_uf?: string;
  specialty?: string;
}

export interface CreateUserWithPasswordPayload extends CreateUserPayload {
  password: string;
}

export interface CreateDoctorPayload {
  email: string;
  full_name: string;
  cpf: string;
  crm: string;
  crm_uf: string;
  specialty: string;
  phone_mobile: string;
}

export interface CreateUserResponse {
  success?: boolean;
  user?: Partial<ApiUser> & {
    full_name?: string;
    roles?: string[];
    email_confirmed_at?: string | null;
  };
  profile?: Record<string, unknown>;
  role?: string;
  patient_id?: string | null;
  message?: string;
}

export interface DeleteUserResponse {
  success?: boolean;
  message?: string;
  userId?: string;
}

export interface UpdateUserPayload {
  email?: string;
  full_name?: string;
  phone?: string;
  phone_mobile?: string;
  role?: ApiRole;
  cpf?: string;
  active?: boolean;
}

export interface PasswordResetResponse {
  success?: boolean;
  message?: string;
}

export interface PatientCreatePayload {
  email: string;
  full_name: string;
  cpf: string;
  phone_mobile: string;
  birth_date: string;
  redirect_url?: string;
}

export interface RegisterPatientResponse {
  success?: boolean;
  patient_id?: string;
  message?: string;
  email?: string;
}

export interface ApiUserInfo {
  user?: Partial<ApiUser> & {
    full_name?: string;
    name?: string;
    roles?: string[];
    phone?: string;
    patient_id?: string;
  };
  profile?: {
    full_name?: string;
    name?: string;
    phone?: string;
    role?: string;
    disabled?: boolean;
  } & Record<string, unknown>;
  roles?: string[];
  role?: string;
}

export interface ApiManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: ApiRole | string;
  phone?: string;
  cpf?: string;
  active?: boolean;
}

interface ApiProfileRecord {
  id?: string;
  user_id?: string;
  auth_user_id?: string;
  email?: string;
  full_name?: string;
  name?: string;
  display_name?: string;
  phone?: string;
  phone_mobile?: string;
  cpf?: string;
  role?: string;
  roles?: string[];
  active?: boolean;
  disabled?: boolean;
}

interface ApiUserRoleRecord {
  user_id?: string;
  id?: string;
  role?: string;
}

type CreatePatientResponse =
  | ApiPatient[]
  | (Partial<ApiPatient> & {
      success?: boolean;
      patient_id?: string;
      user_id?: string;
      patient?: Partial<ApiPatient>;
      data?: Partial<ApiPatient>;
    });

type ApiUserListResponse =
  | ApiProfileRecord[]
  | {
      users?: ApiProfileRecord[];
      profiles?: ApiProfileRecord[];
      data?: ApiProfileRecord[];
      items?: ApiProfileRecord[];
    };

function expectOne<T>(rows: T[], entity: string): T {
  const row = rows[0];
  if (!row) throw new Error(`A API nao retornou ${entity}. Verifique permissoes e dados enviados.`);
  return row;
}

function normalizeCreatedPatient(response: CreatePatientResponse, fallback: Omit<ApiPatient, 'id'>): ApiPatient {
  if (Array.isArray(response)) return expectOne(response, 'paciente criado');

  const source = response.patient ?? response.data ?? response;
  const id = source.id ?? response.patient_id ?? '';
  if (!id) throw new Error('A API criou o paciente, mas nao retornou o identificador.');

  return {
    ...fallback,
    ...source,
    id,
  };
}

function cleanPayload<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')
  ) as Partial<T>;
}

function shouldFallbackPatientCreate(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    msg.includes('bad gateway') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('502')
  );
}

function toCreatePatientBody(data: Omit<ApiPatient, 'id'>): Partial<Omit<ApiPatient, 'id'>> {
  return cleanPayload({
    full_name: data.full_name,
    social_name: data.social_name,
    email: data.email,
    cpf: data.cpf,
    rg: data.rg,
    document_type: data.document_type,
    document_number: data.document_number,
    birth_date: data.birth_date,
    phone_mobile: data.phone_mobile,
    phone1: data.phone1,
    phone2: data.phone2,
    sex: data.sex,
    race: data.race,
    ethnicity: data.ethnicity,
    nationality: data.nationality,
    naturality: data.naturality,
    profession: data.profession,
    marital_status: data.marital_status,
    guardian_name: data.guardian_name,
    guardian_cpf: data.guardian_cpf,
    cep: data.cep,
    street: data.street,
    number: data.number,
    complement: data.complement,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    reference: data.reference,
    blood_type: data.blood_type,
    weight_kg: data.weight_kg,
    height_m: data.height_m,
    bmi: data.bmi,
    vip: data.vip,
    notes: data.notes,
    redirect_url: data.redirect_url,
  });
}

function toRestPatientBody(data: Omit<ApiPatient, 'id'>): Partial<Omit<ApiPatient, 'id'>> {
  return cleanPayload({
    full_name: data.full_name,
    cpf: data.cpf,
    email: data.email,
    phone_mobile: data.phone_mobile,
    birth_date: data.birth_date,
    created_by: data.created_by,
    race: data.race,
    sex: data.sex,
    city: data.city,
    state: data.state,
    notes: data.notes,
  });
}

export type DoctorAppointmentType = 'presencial' | 'telemedicina';

export interface CreateDoctorAvailabilityPayload {
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes?: number;
  appointment_type?: DoctorAppointmentType;
  active?: boolean;
}

export interface ApiDoctorAvailability extends CreateDoctorAvailabilityPayload {
  id: string;
  slot_minutes: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface ApiDoctorException {
  id: string;
  doctor_id: string;
  date: string;
  kind: 'bloqueio' | 'liberacao' | string;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string;
  created_by?: string;
}

const WEEKDAY_VALUES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function toApiWeekday(weekday: number | string | undefined) {
  if (weekday === undefined) return undefined;
  if (typeof weekday === 'number') return WEEKDAY_VALUES[weekday] ?? String(weekday);
  return weekday;
}

function fromApiWeekday(weekday: number | string): number {
  if (typeof weekday === 'number') return weekday;
  const normalized = weekday.toLowerCase().trim();
  const numeric = Number(normalized);
  if (Number.isInteger(numeric)) return numeric;
  const index = WEEKDAY_VALUES.findIndex(value => value === normalized);
  return index >= 0 ? index : 0;
}

function apiAvailabilityToUi(row: ApiDoctorAvailability): ApiDoctorAvailability {
  return { ...row, weekday: fromApiWeekday(row.weekday) };
}

export interface AvailableSlotsPayload {
  doctor_id: string;
  date: string;
}

export interface AvailableSlotsResponse {
  slots?: string[];
  available_slots?: string[];
  data?: string[] | { slots?: string[]; available_slots?: string[] };
}

export interface SendSmsPayload {
  phone_number: string;
  message: string;
  patient_id?: string;
}

export interface SendSmsResponse {
  success?: boolean;
  message?: string;
  sid?: string;
}

export interface ApiSmsLog {
  id: string;
  patient_id?: string | null;
  phone_number: string;
  message: string;
  status?: string | null;
  sid?: string | null;
  twilio_sid?: string | null;
  error_message?: string | null;
  created_at?: string;
}

export interface ApiPatient {
  id: string;
  full_name: string;
  social_name?: string;
  cpf: string;
  email: string;
  rg?: string;
  document_type?: string;
  document_number?: string;
  phone_mobile: string;
  phone1?: string;
  phone2?: string;
  birth_date?: string;
  created_by?: string;
  race?: string;
  sex?: string;
  ethnicity?: string;
  nationality?: string;
  naturality?: string;
  profession?: string;
  marital_status?: string;
  mother_name?: string;
  mother_profession?: string;
  father_name?: string;
  father_profession?: string;
  guardian_name?: string;
  guardian_cpf?: string;
  spouse_name?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  reference?: string;
  blood_type?: string;
  weight_kg?: number;
  height_m?: number;
  bmi?: number;
  rn_in_insurance?: boolean;
  vip?: boolean;
  notes?: string;
  redirect_url?: string;
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
}

export interface ApiReport {
  id: string;
  order_number?: string;
  patient_id: string;
  status: string;
  exam?: string;
  requested_by?: string;
  cid_code?: string;
  diagnosis?: string;
  conclusion?: string;
  content_html?: string;
  content_json?: Record<string, unknown>;
  hide_date?: boolean;
  hide_signature?: boolean;
  due_at?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

const RELEASED_REPORT_STATUS_CANDIDATES = ['liberado', 'finalizado', 'released', 'signed'];

function shouldRetryReleasedReportStatus(err: unknown, status: unknown) {
  if (!status || status === 'draft') return false;
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('report_status') || message.includes('invalid input value for enum');
}

async function writeReportWithStatusFallback<T>(operation: (data: Partial<ApiReport>) => Promise<T>, data: Partial<ApiReport>) {
  try {
    return await operation(data);
  } catch (err) {
    if (!shouldRetryReleasedReportStatus(err, data.status)) throw err;
    let lastError = err;
    for (const status of RELEASED_REPORT_STATUS_CANDIDATES) {
      try {
        return await operation({ ...data, status });
      } catch (retryErr) {
        lastError = retryErr;
      }
    }
    throw lastError;
  }
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

// ─── Usuários ────────────────────────────────────────────────────────────────
export const usersApi = {
  currentInfo: () =>
    request<ApiUserInfo>('/functions/v1/user-info', { method: 'POST' }),

  infoById: (userId: string) =>
    request<ApiUserInfo>('/functions/v1/user-info-by-id', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  list: async (): Promise<ApiManagedUser[]> => {
    const normalizeRole = (role?: string): ApiManagedUser['role'] => {
      const r = role?.toLowerCase().trim();
      if (r === 'admin' || r === 'gestor' || r === 'gestao' || r === 'manager') return 'admin';
      if (r === 'secretaria' || r === 'secretary' || r === 'receptionist') return 'secretaria';
      if (r === 'medico' || r === 'doctor' || r === 'physician') return 'medico';
      return r || 'admin';
    };

    const rowsFromResponse = (response: ApiUserListResponse): ApiProfileRecord[] => {
      if (Array.isArray(response)) return response;
      return response.users ?? response.profiles ?? response.data ?? response.items ?? [];
    };

    const toManagedUsers = (rows: ApiProfileRecord[], roles = new Map<string, string>()) =>
      rows
        .map(row => {
          const id = row.id ?? row.user_id ?? row.auth_user_id ?? '';
          const email = row.email ?? '';
          const fullName = row.full_name ?? row.name ?? row.display_name ?? email.split('@')[0] ?? '';
          const role = normalizeRole(row.role ?? row.roles?.[0] ?? roles.get(id));
          return {
            id,
            email,
            full_name: fullName,
            role,
            phone: row.phone ?? row.phone_mobile,
            cpf: row.cpf,
            active: row.disabled === true ? false : row.active !== false,
          };
        })
        .filter(user => user.id && user.full_name);

    const functionCandidates: Array<{ path: string; method: 'GET' | 'POST' }> = [
      { path: '/functions/v1/list-users', method: 'GET' },
      { path: '/functions/v1/list-users', method: 'POST' },
      { path: '/functions/v1/users', method: 'GET' },
      { path: '/functions/v1/users', method: 'POST' },
      { path: '/functions/v1/admin-users', method: 'GET' },
      { path: '/functions/v1/admin-users', method: 'POST' },
    ];

    for (const candidate of functionCandidates) {
      try {
        const response = await request<ApiUserListResponse>(candidate.path, { method: candidate.method });
        const users = toManagedUsers(rowsFromResponse(response));
        if (users.length > 0) return users;
      } catch {
        // Continua tentando os demais contratos conhecidos.
      }
    }

    const [profiles, userRoles] = await Promise.all([
      request<ApiProfileRecord[]>('/rest/v1/profiles?select=*').catch(() => [] as ApiProfileRecord[]),
      request<ApiUserRoleRecord[]>('/rest/v1/user_roles?select=*').catch(() => [] as ApiUserRoleRecord[]),
    ]);

    const roles = new Map(
      userRoles
        .map(row => [row.user_id ?? row.id ?? '', row.role ?? ''] as const)
        .filter(([id, role]) => id && role)
    );

    return toManagedUsers(profiles, roles);
  },

  create: (data: CreateUserPayload) =>
    request<CreateUserResponse>('/functions/v1/create-user', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createWithPassword: async (data: CreateUserWithPasswordPayload) => {
    const options = {
      method: 'POST',
      body: JSON.stringify(data),
    };
    const candidates = [
      '/create-user-with-password',
      '/functions/v1/create-user-with-password',
    ];

    for (const path of candidates) {
      try {
        return await request<CreateUserResponse>(path, options);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        const lowerMsg = msg.toLowerCase();
        const canRetry =
          msg.includes('404') ||
          lowerMsg.includes('not found') ||
          lowerMsg.includes('failed to fetch');
        if (!canRetry) throw err;
      }
    }

    throw new Error('Endpoint de criacao de usuario com senha nao encontrado.');
  },

  createPatientAccount: (data: PatientCreatePayload) =>
    request<RegisterPatientResponse>('/functions/v1/register-patient', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: async (userId: string, data: UpdateUserPayload) => {
    const body = JSON.stringify({ user_id: userId, userId, id: userId, ...data });
    const candidates = [
      '/functions/v1/update-user',
      '/update-user',
      '/functions/v1/users/update',
    ];

    for (const path of candidates) {
      try {
        return await request<CreateUserResponse>(path, { method: 'POST', body });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        const canRetry =
          msg.includes('404') ||
          msg.toLowerCase().includes('not found') ||
          msg.toLowerCase().includes('failed to fetch');
        if (!canRetry) throw err;
      }
    }

    const profilePayload = {
      email: data.email,
      full_name: data.full_name,
      phone: data.phone ?? data.phone_mobile,
      cpf: data.cpf,
      role: data.role,
      active: data.active,
      disabled: data.active === undefined ? undefined : !data.active,
    };

    await request<ApiProfileRecord[]>(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(profilePayload),
    }, { Prefer: 'return=representation' });

    return { success: true, message: 'Usuário atualizado.' };
  },

  requestPasswordReset: (email: string) =>
    request<PasswordResetResponse>('/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  deletePermanent: async (userId: string) => {
    const body = JSON.stringify({ userId, user_id: userId, id: userId });
    const candidates = [
      '/delete-user',
      '/functions/v1/delete-user',
    ];

    for (const path of candidates) {
      try {
        return await request<DeleteUserResponse>(path, { method: 'POST', body });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        const lowerMsg = msg.toLowerCase();
        const canRetry =
          msg.includes('404') ||
          lowerMsg.includes('not found') ||
          lowerMsg.includes('failed to fetch');
        if (!canRetry) throw err;
      }
    }

    throw new Error('Endpoint de exclusao de usuario nao encontrado.');
  },
};

// ─── Médicos ──────────────────────────────────────────────────────────────────
export const doctorsApi = {
  list: (params: { active?: boolean; specialty?: string } = {}) => {
    const q = new URLSearchParams({ select: '*' });
    if (params.active !== undefined) q.set('active', `eq.${params.active}`);
    if (params.specialty) q.set('specialty', `eq.${params.specialty}`);
    return request<ApiDoctor[]>(`/rest/v1/doctors?${q.toString()}`);
  },

  create: (data: CreateDoctorPayload) =>
    request<ApiDoctor | CreateUserResponse>('/functions/v1/create-doctor', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<ApiDoctor>) =>
    request<ApiDoctor[]>(`/rest/v1/doctors?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }).then(rows => expectOne(rows, 'medico atualizado')),
};

// ─── Pacientes ────────────────────────────────────────────────────────────────
const CREATE_PATIENT_URLS = ['/functions/v1/create-patient', '/create-patient'];

export const patientsApi = {
  list: (params: { search?: string; cpf?: string; email?: string; limit?: number; offset?: number; created_by?: string } = {}) => {
    const q = new URLSearchParams({ select: '*', order: 'full_name.asc' });
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    if (params.cpf) q.set('cpf', `eq.${params.cpf}`);
    if (params.email) q.set('email', `eq.${params.email}`);
    if (params.created_by) q.set('created_by', `eq.${params.created_by}`);
    if (params.search) q.set('full_name', `ilike.*${params.search}*`);
    return request<ApiPatient[]>(`/rest/v1/patients?${q.toString()}`);
  },

  listByIds: (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return Promise.resolve([] as ApiPatient[]);
    const q = new URLSearchParams({ select: '*', order: 'full_name.asc' });
    q.set('id', `in.(${uniqueIds.join(',')})`);
    return request<ApiPatient[]>(`/rest/v1/patients?${q.toString()}`);
  },

  create: async (data: Omit<ApiPatient, 'id'>) => {
    let lastError: unknown;
    for (const path of CREATE_PATIENT_URLS) {
      try {
        const response = await request<CreatePatientResponse>(path, {
          method: 'POST',
          body: JSON.stringify(toCreatePatientBody(data)),
        });
        return normalizeCreatedPatient(response, data);
      } catch (err) {
        lastError = err;
        if (!shouldFallbackPatientCreate(err)) throw err;
      }
    }
    if (!shouldFallbackPatientCreate(lastError)) throw lastError;
    return request<ApiPatient[]>('/rest/v1/patients', {
      method: 'POST',
      body: JSON.stringify(toRestPatientBody(data)),
    }, { Prefer: 'return=representation' }).then(rows => expectOne(rows, 'paciente criado'));
  },

  update: (id: string, data: Partial<ApiPatient>) =>
    request<ApiPatient[]>(`/rest/v1/patients?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }).then(rows => expectOne(rows, 'paciente atualizado')),

  delete: async (id: string) => {
    const filter = new URLSearchParams();
    filter.set('id', `eq.${id}`);

    const deleteByFilter = async () => {
      const deletedRows = await request<ApiPatient[]>(
        `/rest/v1/patients?${filter.toString()}`,
        { method: 'DELETE' },
        { Prefer: 'return=representation' }
      );

      if (deletedRows.length === 0) {
        throw new Error('A API nao excluiu nenhum paciente. Verifique se o perfil logado tem permissao de admin/gestao e se o id existe.');
      }
    };

    try {
      await request<void>(`/rest/v1/patients/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const lowerMsg = msg.toLowerCase();
      const canFallback =
        msg.includes('400') ||
        msg.includes('404') ||
        lowerMsg.includes('invalid path') ||
        lowerMsg.includes('not found') ||
        lowerMsg.includes('erro na requisicao (400)') ||
        lowerMsg.includes('erro na requisicao (404)');
      if (!canFallback) throw err;
      await deleteByFilter();
    }
  },
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

  listForPatient: (patientId: string) =>
    appointmentsApi.list({ patient_id: patientId }),

  create: (data: Omit<ApiAppointment, 'id'>) =>
    request<ApiAppointment[]>('/rest/v1/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }).then(rows => expectOne(rows, 'agendamento criado')),

  update: (id: string, data: Partial<ApiAppointment>) =>
    request<ApiAppointment[]>(`/rest/v1/appointments?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }).then(rows => expectOne(rows, 'agendamento atualizado')),

  delete: (id: string) =>
    request<void>(`/rest/v1/appointments?id=eq.${id}`, { method: 'DELETE' }),

  cancel: async (id: string) => {
    const rows = await request<ApiAppointment[]>(`/rest/v1/appointments?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    }, { Prefer: 'return=representation' });

    if (rows.length === 0) {
      throw new Error('A API nao cancelou nenhum agendamento. Verifique permissao do perfil logado e se o agendamento existe.');
    }

    return rows[0];
  },
};

// ─── Laudos / Reports ─────────────────────────────────────────────────────────
// ─── Disponibilidade / Slots ─────────────────────────────────────────────────
export const availabilityApi = {
  list: (params: { doctor_id?: string; weekday?: number; active?: boolean; appointment_type?: string } = {}) => {
    const q = new URLSearchParams({ select: '*' });
    if (params.doctor_id) q.set('doctor_id', `eq.${params.doctor_id}`);
    if (params.weekday !== undefined) q.set('weekday', `eq.${toApiWeekday(params.weekday)}`);
    if (params.active !== undefined) q.set('active', `eq.${params.active}`);
    if (params.appointment_type) q.set('appointment_type', `eq.${params.appointment_type}`);
    return request<ApiDoctorAvailability[]>(`/rest/v1/doctor_availability?${q.toString()}`)
      .then(rows => rows.map(apiAvailabilityToUi));
  },

  create: (data: CreateDoctorAvailabilityPayload) =>
    request<ApiDoctorAvailability[] | ApiDoctorAvailability>('/rest/v1/doctor_availability', {
      method: 'POST',
      body: JSON.stringify({ ...data, weekday: toApiWeekday(data.weekday) }),
    }, { Prefer: 'return=representation' }).then(response =>
      apiAvailabilityToUi(Array.isArray(response) ? expectOne(response, 'disponibilidade criada') : response)
    ),

  update: (id: string, data: Partial<ApiDoctorAvailability>) =>
    request<ApiDoctorAvailability[]>(`/rest/v1/doctor_availability?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...data, weekday: toApiWeekday(data.weekday) }),
    }, { Prefer: 'return=representation' }).then(rows => apiAvailabilityToUi(expectOne(rows, 'disponibilidade atualizada'))),

  delete: (id: string) =>
    request<void>(`/rest/v1/doctor_availability?id=eq.${id}`, { method: 'DELETE' }),

  listExceptions: (params: { doctor_id?: string; date?: string; kind?: string } = {}) => {
    const q = new URLSearchParams({ select: '*' });
    if (params.doctor_id) q.set('doctor_id', `eq.${params.doctor_id}`);
    if (params.date) q.set('date', `eq.${params.date}`);
    if (params.kind) q.set('kind', `eq.${params.kind}`);
    return request<ApiDoctorException[]>(`/rest/v1/doctor_exceptions?${q.toString()}`);
  },

  createException: (data: Omit<ApiDoctorException, 'id'>) =>
    request<ApiDoctorException[]>('/rest/v1/doctor_exceptions', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { Prefer: 'return=representation' }).then(rows => expectOne(rows, 'excecao criada')),

  getAvailableSlots: (data: AvailableSlotsPayload) =>
    request<AvailableSlotsResponse>('/functions/v1/get-available-slots', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const reportsApi = {
  list: (params: { patient_id?: string; status?: string; created_by?: string } = {}) => {
    const q = new URLSearchParams({ order: 'created_at.desc' });
    if (params.patient_id) q.set('patient_id', `eq.${params.patient_id}`);
    if (params.status) q.set('status', `eq.${params.status}`);
    if (params.created_by) q.set('created_by', `eq.${params.created_by}`);
    return request<ApiReport[]>(`/rest/v1/reports?${q.toString()}`);
  },

  listForPatient: (patientId: string, status?: ApiReport['status']) =>
    reportsApi.list({ patient_id: patientId, status }),

  listByCreators: (creatorIds: string[]) => {
    const uniqueIds = Array.from(new Set(creatorIds.filter(Boolean)));
    if (uniqueIds.length === 0) return Promise.resolve([] as ApiReport[]);
    const q = new URLSearchParams({ order: 'created_at.desc' });
    q.set('created_by', `in.(${uniqueIds.join(',')})`);
    return request<ApiReport[]>(`/rest/v1/reports?${q.toString()}`);
  },

  create: (data: Omit<ApiReport, 'id' | 'order_number' | 'created_at' | 'updated_at'>) =>
    writeReportWithStatusFallback(
      payload => request<ApiReport[]>('/rest/v1/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, { Prefer: 'return=representation' }).then(rows => expectOne(rows, 'laudo criado')),
      data
    ),

  update: (id: string, data: Partial<ApiReport>) =>
    writeReportWithStatusFallback(
      payload => request<ApiReport[]>(`/rest/v1/reports?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }, { Prefer: 'return=representation' }).then(rows => expectOne(rows, 'laudo atualizado')),
      data
    ),

  delete: (id: string) =>
    request<void>(`/rest/v1/reports?id=eq.${id}`, { method: 'DELETE' }),
};

// ─── SMS ─────────────────────────────────────────────────────────────────────
export const smsApi = {
  send: (data: SendSmsPayload) =>
    request<SendSmsResponse>('/functions/v1/send-sms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logs: (limit = 100) => {
    const q = new URLSearchParams({
      select: '*',
      order: 'created_at.desc',
      limit: String(limit),
    });
    return request<ApiSmsLog[]>(`/rest/v1/sms_logs?${q.toString()}`);
  },
};
