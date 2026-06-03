const DEFAULT_MESSAGE = 'Não foi possível concluir a ação. Tente novamente em instantes.';

function getRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : '';
}

export function toUserFacingErrorMessage(error: unknown, fallback = DEFAULT_MESSAGE): string {
  const raw = getRawMessage(error).trim();
  const lower = raw.toLowerCase();

  if (!raw) return fallback;
  if (lower.includes('already') || lower.includes('duplicate') || lower.includes('exists') || lower.includes('409')) {
    return 'Já existe um cadastro com esses dados.';
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'Informe um e-mail válido.';
  }
  if (lower.includes('row-level security') || lower.includes('permission') || lower.includes('permiss') || lower.includes('forbidden') || lower.includes('403')) {
    return 'Seu perfil não tem permissão para realizar esta ação.';
  }
  if (lower.includes('unauthorized') || lower.includes('jwt') || lower.includes('token') || lower.includes('401')) {
    return 'Sua sessão expirou. Entre novamente e tente outra vez.';
  }
  if (lower.includes('too many') || lower.includes('rate') || lower.includes('429')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }
  if (lower.includes('sms_api_url') || lower.includes('sms_api_key')) {
    return 'O serviço de SMS ainda não foi configurado no servidor.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('fetch') || lower.includes('502') || lower.includes('503')) {
    return 'Não foi possível conectar ao serviço agora. Tente novamente em instantes.';
  }
  if (lower.includes('foreign key') || lower.includes('violates') || lower.includes('referenced') || lower.includes('vinculados')) {
    return 'Não foi possível excluir porque existem registros vinculados.';
  }
  if (
    lower.includes('api') ||
    lower.includes('supabase') ||
    lower.includes('schema cache') ||
    lower.includes('edge function') ||
    lower.includes('rpc') ||
    lower.includes('vite_') ||
    lower.includes('gemini_api_key') ||
    lower.includes('openai_api_key') ||
    lower.includes('groq_api_key')
  ) {
    return fallback;
  }

  return raw;
}
