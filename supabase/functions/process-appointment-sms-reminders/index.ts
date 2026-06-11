import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse } from '../_shared/ai/security.ts';

type ClaimedNotification = {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string | null;
  notification_type: 'created' | 'reminder_7d' | 'reminder_1d';
  scheduled_for: string;
  attempt_count: number;
  max_attempts: number;
  patient_full_name: string | null;
  patient_phone: string | null;
  patient_active: boolean | null;
  doctor_full_name: string | null;
  doctor_specialty: string | null;
  appointment_status: string | null;
  appointment_scheduled_at: string | null;
};

function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

function assertAuthorized(req: Request) {
  const cronSecret = Deno.env.get('SMS_CRON_SECRET') ?? '';
  if (!cronSecret) return;

  const authHeader = req.headers.get('authorization') ?? '';
  const cronHeader = req.headers.get('x-cron-secret') ?? '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

  if (cronHeader !== cronSecret && bearer !== cronSecret) {
    throw new Error('Nao autorizado para processamento de lembretes SMS.');
  }
}

function normalizePhoneForSms(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return digits ? `+${digits}` : '';
}

function formatDateTimeBR(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '--/--/----', time: '--:--' };
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date);
  const timeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return { date: dateFmt, time: timeFmt };
}

function isAppointmentSendable(status: string | null) {
  const normalized = String(status ?? '').toLowerCase().trim();
  return normalized === 'requested' || normalized === 'confirmed';
}

function buildMessage(payload: ClaimedNotification) {
  const patientName = payload.patient_full_name?.trim() || 'Paciente';
  const doctorName = payload.doctor_full_name?.trim() || 'Equipe medica';
  const specialty = payload.doctor_specialty?.trim() || 'Nao informada';
  const scheduleRef = formatDateTimeBR(payload.appointment_scheduled_at ?? payload.scheduled_for);
  const clinicName = Deno.env.get('SMS_CLINIC_NAME')?.trim() || '';
  const unitName = Deno.env.get('SMS_CLINIC_UNIT')?.trim();
  const clinicLine = unitName
    ? `Unidade: ${unitName}`
    : clinicName
      ? `Clinica: ${clinicName}`
      : '';
  const signatureLine = clinicName ? `Equipe ${clinicName}.` : 'Equipe da clinica.';

  if (payload.notification_type === 'created') {
    return [
      `Ola ${patientName}.`,
      '',
      `Sua consulta foi agendada com Dr. ${doctorName}.`,
      '',
      `Especialidade: ${specialty}`,
      `Data: ${scheduleRef.date}`,
      `Horario: ${scheduleRef.time}`,
      ...(clinicLine ? [clinicLine] : []),
      '',
      signatureLine,
    ].join('\n');
  }

  if (payload.notification_type === 'reminder_7d') {
    return [
      `Ola ${patientName}.`,
      '',
      'Lembramos que sua consulta ocorrera em 7 dias.',
      '',
      `Medico: Dr. ${doctorName}`,
      `Data: ${scheduleRef.date}`,
      `Horario: ${scheduleRef.time}`,
      ...(clinicLine ? [clinicLine] : []),
      '',
      signatureLine,
    ].join('\n');
  }

  return [
    `Ola ${patientName}.`,
    '',
    'Sua consulta acontecera amanha.',
    '',
    `Medico: Dr. ${doctorName}`,
    `Data: ${scheduleRef.date}`,
    `Horario: ${scheduleRef.time}`,
    ...(clinicLine ? [clinicLine] : []),
    '',
    signatureLine,
  ].join('\n');
}

async function sendSms(phoneNumber: string, message: string) {
  const smsApiUrl = Deno.env.get('SMS_API_URL') ?? '';
  const smsApiKey = Deno.env.get('SMS_API_KEY') ?? '';
  if (!smsApiUrl) throw new Error('SMS_API_URL nao configurada nos secrets da Supabase.');
  if (!smsApiKey) throw new Error('SMS_API_KEY nao configurada nos secrets da Supabase.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(smsApiUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${smsApiKey}`,
        apikey: smsApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        message,
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      throw new Error(String(body.message ?? body.error ?? `Falha no provedor SMS (${response.status}).`));
    }

    const providerMessageId = String(
      body.provider_message_id ??
      body.sid ??
      body.id ??
      '',
    );

    return { providerMessageId, providerBody: body };
  } finally {
    clearTimeout(timeout);
  }
}

async function insertSmsLog(
  supabase: ReturnType<typeof createAdminClient>,
  row: ClaimedNotification,
  phoneNumber: string,
  message: string,
  status: 'sent' | 'error' | 'cancelled',
  options: { providerMessageId?: string; providerResponse?: unknown; errorMessage?: string } = {},
) {
  await supabase.from('sms_logs').insert({
    patient_id: row.patient_id,
    appointment_id: row.appointment_id,
    notification_type: row.notification_type,
    scheduled_for: row.scheduled_for,
    phone_number: phoneNumber,
    message,
    status,
    sid: options.providerMessageId ?? null,
    provider_message_id: options.providerMessageId ?? null,
    provider_response: options.providerResponse ?? null,
    error_message: options.errorMessage ?? null,
  });
}

async function finalizeNotification(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  updates: Record<string, unknown>,
) {
  await supabase
    .from('appointment_sms_notifications')
    .update(updates)
    .eq('id', id);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return jsonResponse({}, 200, req);
  if (req.method !== 'POST') return jsonResponse({ success: false, message: 'Metodo nao permitido.' }, 405);

  try {
    assertAuthorized(req);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const limit = Math.max(1, Math.min(Number(body.limit ?? 100) || 100, 500));

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('claim_due_appointment_sms_notifications', { p_limit: limit });
    if (error) throw new Error(error.message);

    const claimed = (data ?? []) as ClaimedNotification[];
    let sent = 0;
    let failed = 0;
    let cancelled = 0;

    for (const row of claimed) {
      const safePhone = normalizePhoneForSms(String(row.patient_phone ?? ''));
      const message = buildMessage(row);

      const cancelWithReason = async (reason: string) => {
        cancelled += 1;
        await finalizeNotification(supabase, row.id, {
          status: 'cancelled',
          error_message: reason,
          provider_response: { reason },
          updated_at: new Date().toISOString(),
        });
        await insertSmsLog(supabase, row, safePhone || String(row.patient_phone ?? ''), message, 'cancelled', {
          errorMessage: reason,
          providerResponse: { reason },
        });
      };

      if (!isAppointmentSendable(row.appointment_status)) {
        await cancelWithReason('Consulta sem status valido para envio.');
        continue;
      }

      if (row.patient_active === false) {
        await cancelWithReason('Paciente inativo.');
        continue;
      }

      if (!/^\+55\d{10,11}$/.test(safePhone)) {
        await cancelWithReason('Telefone invalido para envio de SMS.');
        continue;
      }

      try {
        const provider = await sendSms(safePhone, message);
        sent += 1;

        await finalizeNotification(supabase, row.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: provider.providerMessageId || null,
          provider_response: provider.providerBody,
          error_message: null,
          updated_at: new Date().toISOString(),
        });

        await insertSmsLog(supabase, row, safePhone, message, 'sent', {
          providerMessageId: provider.providerMessageId,
          providerResponse: provider.providerBody,
        });
      } catch (err) {
        failed += 1;
        const errorMessage = err instanceof Error ? err.message : 'Erro ao enviar SMS.';
        const shouldCancel = row.attempt_count >= row.max_attempts;

        await finalizeNotification(supabase, row.id, {
          status: shouldCancel ? 'cancelled' : 'failed',
          error_message: errorMessage,
          provider_response: { error: errorMessage },
          updated_at: new Date().toISOString(),
        });

        await insertSmsLog(supabase, row, safePhone, message, shouldCancel ? 'cancelled' : 'error', {
          errorMessage,
          providerResponse: { error: errorMessage },
        });
      }
    }

    return jsonResponse({
      success: true,
      processed: claimed.length,
      sent,
      failed,
      cancelled,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar lembretes SMS.';
    const status = message.toLowerCase().includes('autorizado') ? 403 : 400;
    return jsonResponse({ success: false, message }, status);
  }
});
