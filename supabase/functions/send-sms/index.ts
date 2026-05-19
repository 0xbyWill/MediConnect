import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, readJson, requireUser, sanitizePayload, sanitizeText } from '../_shared/ai/security.ts';

type SendSmsBody = {
  patient_id?: string;
  phone_number?: string;
  message?: string;
};

const MESSAGE_MAX_LENGTH = 320;
const FORBIDDEN_SMS_TERMS = [
  'diagnostico',
  'diagnóstico',
  'prescricao',
  'prescrição',
  'laudo completo',
  'cid',
  'tratamento',
];

function createSupabase(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
}

async function requireSmsSender(supabase: ReturnType<typeof createSupabase>) {
  const user = await requireUser(supabase);
  const { data: profile } = await supabase
    .from('profiles')
    .select('role,active,disabled')
    .or(`id.eq.${user.id},user_id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  const metadataRole = String(user.app_metadata?.role ?? user.user_metadata?.role ?? '').toLowerCase();
  const role = String(profile?.role ?? metadataRole).toLowerCase();
  const active = profile?.active !== false && profile?.disabled !== true;

  if (!active || !['gestao', 'gestor', 'admin', 'secretaria'].includes(role)) {
    throw new Error('Permissao obrigatoria para envio de SMS.');
  }

  return user;
}

function normalizePhoneForSms(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return digits ? `+${digits}` : '';
}

function validatePayload(body: SendSmsBody) {
  const patientId = sanitizeText(body.patient_id, 80);
  const phoneNumber = normalizePhoneForSms(String(body.phone_number ?? ''));
  const message = sanitizeText(body.message, MESSAGE_MAX_LENGTH);

  if (!patientId) throw new Error('patient_id obrigatorio.');
  if (!phoneNumber) throw new Error('phone_number obrigatorio.');
  if (!/^\+55\d{10,11}$/.test(phoneNumber)) throw new Error('Telefone invalido para SMS no Brasil.');
  if (!message.trim()) throw new Error('message obrigatoria.');
  if (message.length > MESSAGE_MAX_LENGTH) throw new Error(`Mensagem deve ter no maximo ${MESSAGE_MAX_LENGTH} caracteres.`);

  const normalizedMessage = message.toLowerCase();
  if (FORBIDDEN_SMS_TERMS.some(term => normalizedMessage.includes(term))) {
    throw new Error('SMS deve conter apenas informacoes administrativas.');
  }

  return { patientId, phoneNumber, message };
}

async function logSms(
  supabase: ReturnType<typeof createSupabase>,
  payload: {
    patientId: string;
    userId: string;
    phoneNumber: string;
    message: string;
    status: string;
    providerMessageId?: string;
    errorMessage?: string;
  },
) {
  await supabase.from('sms_logs').insert({
    patient_id: payload.patientId,
    user_id: payload.userId,
    phone_number: payload.phoneNumber,
    message: payload.message,
    status: payload.status,
    sid: payload.providerMessageId ?? null,
    provider_message_id: payload.providerMessageId ?? null,
    error_message: payload.errorMessage ?? null,
  }).catch(() => undefined);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return jsonResponse({});
  if (req.method !== 'POST') return jsonResponse({ success: false, message: 'Metodo nao permitido.' }, 405);

  const supabase = createSupabase(req);
  let userId = '';
  let parsed: ReturnType<typeof validatePayload> | null = null;

  try {
    const user = await requireSmsSender(supabase);
    userId = user.id;
    const body = sanitizePayload(await readJson<Record<string, unknown>>(req)) as SendSmsBody;
    parsed = validatePayload(body);

    const smsApiUrl = Deno.env.get('SMS_API_URL') ?? 'https://mock.apidog.com/m1/1053378-0-default/send-sms';
    const smsApiKey = Deno.env.get('SMS_API_KEY') ?? '';
    if (!smsApiKey) throw new Error('SMS_API_KEY nao configurada nos secrets da Supabase.');

    const providerResponse = await fetch(smsApiUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${smsApiKey}`,
        apikey: smsApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        patient_id: parsed.patientId,
        phone_number: parsed.phoneNumber,
        message: parsed.message,
      }),
    });

    const providerBody = await providerResponse.json().catch(() => ({} as Record<string, unknown>));
    if (!providerResponse.ok) {
      throw new Error(String(providerBody.message ?? providerBody.error ?? `Falha no provedor SMS (${providerResponse.status}).`));
    }

    const providerMessageId = String(
      providerBody.provider_message_id ??
      providerBody.sid ??
      providerBody.id ??
      '',
    );

    await logSms(supabase, {
      patientId: parsed.patientId,
      userId,
      phoneNumber: parsed.phoneNumber,
      message: parsed.message,
      status: 'sent',
      providerMessageId,
    });

    return jsonResponse({
      success: true,
      message: 'SMS enviado com sucesso.',
      provider_message_id: providerMessageId || undefined,
      sid: providerMessageId || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao enviar SMS.';
    if (parsed && userId) {
      await logSms(supabase, {
        patientId: parsed.patientId,
        userId,
        phoneNumber: parsed.phoneNumber,
        message: parsed.message,
        status: 'error',
        errorMessage: message,
      });
    }
    const status = message.includes('Permissao') || message.includes('autenticado') ? 403 : 400;
    return jsonResponse({ success: false, message, error: message }, status);
  }
});
