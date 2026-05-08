import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, readJson } from '../_shared/ai/security.ts';

const ADMIN_ROLES = new Set(['admin', 'gestor', 'gestao', 'manager']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DeleteUserBody = {
  userId?: string;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type AuthTarget = {
  userId: string;
  email: string;
};

function createUserClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
}

function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

async function getProfileRole(adminClient: SupabaseAdmin, userId: string) {
  const { data } = await adminClient
    .from('profiles')
    .select('role,active,disabled')
    .or(`id.eq.${userId},user_id.eq.${userId},auth_user_id.eq.${userId}`)
    .maybeSingle();

  return data as { role?: string; active?: boolean; disabled?: boolean } | null;
}

async function getUserById(adminClient: SupabaseAdmin, userId: string): Promise<AuthTarget | null> {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return {
    userId: data.user.id,
    email: data.user.email ?? '',
  };
}

async function findUserByEmail(adminClient: SupabaseAdmin, email: string): Promise<AuthTarget | null> {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return null;

    const found = data.users.find(user => user.email?.trim().toLowerCase() === normalizedEmail);
    if (found) {
      return {
        userId: found.id,
        email: found.email ?? normalizedEmail,
      };
    }

    if (data.users.length < 1000) return null;
  }

  return null;
}

async function resolveFromTable(
  adminClient: SupabaseAdmin,
  table: string,
  requestedId: string,
): Promise<AuthTarget | null> {
  for (const lookupColumn of ['id', 'user_id', 'auth_user_id', 'profile_id']) {
    const { data, error } = await adminClient
      .from(table)
      .select('*')
      .eq(lookupColumn, requestedId)
      .limit(1);

    if (error || !Array.isArray(data) || !data[0]) continue;

    const row = data[0] as Record<string, unknown>;
    const candidateIds = ['auth_user_id', 'user_id', 'profile_id', 'id']
      .map(column => String(row[column] ?? '').trim())
      .filter(value => UUID_RE.test(value));

    for (const candidateId of candidateIds) {
      const user = await getUserById(adminClient, candidateId);
      if (user) return user;
    }

    const byEmail = await findUserByEmail(adminClient, String(row.email ?? ''));
    if (byEmail) return byEmail;
  }

  return null;
}

async function resolveTargetUser(adminClient: SupabaseAdmin, requestedId: string): Promise<AuthTarget | null> {
  const direct = await getUserById(adminClient, requestedId);
  if (direct) return direct;

  for (const table of ['profiles', 'doctors', 'patients']) {
    const resolved = await resolveFromTable(adminClient, table, requestedId);
    if (resolved) return resolved;
  }

  return null;
}

async function logDeleteAttempt(
  adminClient: SupabaseAdmin,
  payload: Record<string, unknown>,
) {
  await adminClient
    .from('ai_action_logs')
    .insert({
      action_type: 'delete_user',
      admin_id: payload.actorId,
      input_payload: payload,
      output_payload: {},
      status: payload.status,
      error_message: payload.error,
    })
    .catch(() => undefined);
}

async function collectIds(adminClient: SupabaseAdmin, table: string, column: string, value: string) {
  if (!value) return [] as string[];
  const { data, error } = await adminClient
    .from(table)
    .select('id')
    .eq(column, value);

  if (error || !Array.isArray(data)) return [] as string[];
  return data
    .map(row => String((row as { id?: unknown }).id ?? ''))
    .filter(Boolean);
}

async function deleteByEq(adminClient: SupabaseAdmin, table: string, column: string, value: string) {
  if (!value) return;
  await adminClient
    .from(table)
    .delete()
    .eq(column, value)
    .catch(() => undefined);
}

async function deleteByIn(adminClient: SupabaseAdmin, table: string, column: string, values: string[]) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));
  if (uniqueValues.length === 0) return;
  await adminClient
    .from(table)
    .delete()
    .in(column, uniqueValues)
    .catch(() => undefined);
}

function isRelationError(err: unknown) {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('foreign key') ||
    message.includes('violates') ||
    message.includes('constraint') ||
    message.includes('referenced') ||
    message.includes('still referenced')
  );
}

async function cleanupRelatedData(adminClient: SupabaseAdmin, userId: string, email: string) {
  const doctorIds = Array.from(new Set([
    ...(await collectIds(adminClient, 'doctors', 'id', userId)),
    ...(await collectIds(adminClient, 'doctors', 'user_id', userId)),
    ...(await collectIds(adminClient, 'doctors', 'auth_user_id', userId)),
    ...(await collectIds(adminClient, 'doctors', 'profile_id', userId)),
    ...(await collectIds(adminClient, 'doctors', 'email', email)),
  ]));

  const patientIds = Array.from(new Set([
    ...(await collectIds(adminClient, 'patients', 'id', userId)),
    ...(await collectIds(adminClient, 'patients', 'user_id', userId)),
    ...(await collectIds(adminClient, 'patients', 'auth_user_id', userId)),
    ...(await collectIds(adminClient, 'patients', 'created_by', userId)),
    ...(await collectIds(adminClient, 'patients', 'email', email)),
  ]));

  await deleteByIn(adminClient, 'patients_audit', 'patient_id', patientIds);
  await deleteByEq(adminClient, 'patients_audit', 'user_id', userId);
  await deleteByEq(adminClient, 'patients_audit', 'created_by', userId);
  await deleteByEq(adminClient, 'patients_audit', 'updated_by', userId);
  await deleteByEq(adminClient, 'patients_audit', 'changed_by', userId);

  await deleteByIn(adminClient, 'reports', 'patient_id', patientIds);
  await deleteByEq(adminClient, 'reports', 'created_by', userId);
  await deleteByEq(adminClient, 'reports', 'requested_by', userId);
  await deleteByEq(adminClient, 'reports', 'updated_by', userId);

  await deleteByIn(adminClient, 'appointments', 'patient_id', patientIds);
  await deleteByIn(adminClient, 'appointments', 'doctor_id', doctorIds);
  await deleteByEq(adminClient, 'appointments', 'created_by', userId);
  await deleteByEq(adminClient, 'appointments', 'updated_by', userId);

  await deleteByIn(adminClient, 'doctor_availability', 'doctor_id', doctorIds);
  await deleteByEq(adminClient, 'doctor_availability', 'created_by', userId);
  await deleteByEq(adminClient, 'doctor_availability', 'updated_by', userId);

  await deleteByIn(adminClient, 'doctor_exceptions', 'doctor_id', doctorIds);
  await deleteByEq(adminClient, 'doctor_exceptions', 'created_by', userId);

  await deleteByIn(adminClient, 'sms_logs', 'patient_id', patientIds);

  await deleteByIn(adminClient, 'patients', 'id', patientIds);
  await deleteByEq(adminClient, 'patients', 'user_id', userId);
  await deleteByEq(adminClient, 'patients', 'auth_user_id', userId);
  await deleteByEq(adminClient, 'patients', 'created_by', userId);
  await deleteByEq(adminClient, 'patients', 'email', email);

  await deleteByIn(adminClient, 'doctors', 'id', doctorIds);
  await deleteByEq(adminClient, 'doctors', 'user_id', userId);
  await deleteByEq(adminClient, 'doctors', 'auth_user_id', userId);
  await deleteByEq(adminClient, 'doctors', 'profile_id', userId);
  await deleteByEq(adminClient, 'doctors', 'email', email);

  await deleteByEq(adminClient, 'user_roles', 'user_id', userId);
  await deleteByEq(adminClient, 'user_roles', 'id', userId);

  await deleteByEq(adminClient, 'profiles', 'id', userId);
  await deleteByEq(adminClient, 'profiles', 'user_id', userId);
  await deleteByEq(adminClient, 'profiles', 'auth_user_id', userId);
  await deleteByEq(adminClient, 'profiles', 'email', email);
}

async function hardDeleteUser(adminClient: SupabaseAdmin, userId: string, email: string) {
  const firstAttempt = await adminClient.auth.admin.deleteUser(userId);
  if (!firstAttempt.error) return;
  if (!isRelationError(firstAttempt.error)) throw firstAttempt.error;

  await cleanupRelatedData(adminClient, userId, email);

  const secondAttempt = await adminClient.auth.admin.deleteUser(userId);
  if (secondAttempt.error) throw secondAttempt.error;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return jsonResponse({});
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo nao permitido' }, 405);

  const userClient = createUserClient(req);
  const adminClient = createAdminClient();
  let actorId = '';
  let targetUserId = '';

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    actorId = authData.user.id;
    const body = await readJson<DeleteUserBody>(req);
    targetUserId = String(body.userId ?? '').trim();

    if (!targetUserId) {
      return jsonResponse({ error: 'userId e obrigatorio' }, 400);
    }

    if (!UUID_RE.test(targetUserId)) {
      return jsonResponse({ error: 'userId invalido' }, 400);
    }

    if (targetUserId === actorId) {
      return jsonResponse({ error: 'Nao e possivel deletar seu proprio usuario' }, 400);
    }

    const profile = await getProfileRole(adminClient, actorId);
    const metadataRole = String(authData.user.app_metadata?.role ?? authData.user.user_metadata?.role ?? '').toLowerCase();
    const role = String(profile?.role ?? metadataRole).toLowerCase();
    const active = profile?.active !== false && profile?.disabled !== true;

    if (!active || !ADMIN_ROLES.has(role)) {
      return jsonResponse({ error: 'Apenas admins/gestores podem deletar usuarios' }, 403);
    }

    const target = await resolveTargetUser(adminClient, targetUserId);
    if (!target) {
      return jsonResponse({ error: 'Usuario alvo nao encontrado' }, 404);
    }

    if (target.userId === actorId) {
      return jsonResponse({ error: 'Nao e possivel deletar seu proprio usuario' }, 400);
    }

    await hardDeleteUser(adminClient, target.userId, target.email);

    await logDeleteAttempt(adminClient, {
      actorId,
      requestedUserId: targetUserId,
      targetUserId: target.userId,
      status: 'success',
    });

    return jsonResponse({
      success: true,
      message: 'Usuario deletado permanentemente',
      userId: target.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao deletar usuario';
    await logDeleteAttempt(adminClient, {
      actorId,
      targetUserId,
      status: 'error',
      error: message,
    });
    return jsonResponse({ error: message }, 500);
  }
});
