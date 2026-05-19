export type SmsTemplateId =
  | 'appointment_reminder'
  | 'appointment_tomorrow'
  | 'report_available'
  | 'secretary_contact'
  | 'appointment_confirmation'
  | 'return_request';

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
    message: 'Lembrete: {nome}, você possui consulta agendada em {data} às {hora}. MediConnect.',
  },
  {
    id: 'appointment_tomorrow',
    label: 'Consulta amanhã',
    message: 'Lembrete: {nome}, sua consulta está marcada para amanhã às {hora}. Em caso de dúvida, fale com a secretaria.',
  },
  {
    id: 'report_available',
    label: 'Laudo disponível',
    message: 'MediConnect: {nome}, há um laudo disponível para consulta no sistema. Não responda este SMS.',
  },
  {
    id: 'secretary_contact',
    label: 'Contato da secretaria',
    message: 'MediConnect: {nome}, a secretaria tentou contato. Por favor, retorne quando possível.',
  },
  {
    id: 'appointment_confirmation',
    label: 'Confirmação de agendamento',
    message: 'MediConnect: {nome}, sua consulta foi agendada para {data} às {hora}.',
  },
  {
    id: 'return_request',
    label: 'Solicitação de retorno',
    message: 'MediConnect: {nome}, solicitamos retorno de contato com a secretaria para tratar de assunto administrativo.',
  },
];
