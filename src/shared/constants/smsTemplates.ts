export type SmsTemplateId =
  | 'appointment_reminder'
  | 'appointment_confirmation'
  | 'appointment_advance'
  | 'general_notice';

export interface SmsTemplate {
  id: SmsTemplateId;
  label: string;
  message: string;
}

export const SMS_MESSAGE_MAX_LENGTH = 320;

export const SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'appointment_reminder',
    label: 'Lembrete de consulta',
    message: 'Ola, {nome}. Lembrete: voce possui consulta agendada no MediConnect em {data} as {hora}.',
  },
  {
    id: 'appointment_confirmation',
    label: 'Confirmacao de consulta',
    message: 'Ola, {nome}. Sua consulta no MediConnect esta confirmada para {data} as {hora}.',
  },
  {
    id: 'appointment_advance',
    label: 'Antecipacao de consulta',
    message: 'Ola, {nome}. Surgiu uma possibilidade de antecipar sua consulta. Responda a clinica para confirmar interesse.',
  },
  {
    id: 'general_notice',
    label: 'Comunicado geral',
    message: 'Ola, {nome}. Temos um comunicado importante da clinica. Entre em contato para mais informacoes.',
  },
];
