import type { SupabaseClientLike } from '../ai/repository.ts';
import { requireUser } from '../ai/security.ts';

const ALLOWED_ROLES = new Set(['medico', 'gestao', 'gestor', 'admin', 'manager']);

export async function requireMedicationLibraryAccess(supabase: SupabaseClientLike) {
  const user = await requireUser(supabase);
  const { data: profile } = await supabase
    .from('profiles')
    .select('role,active,disabled')
    .or(`id.eq.${user.id},user_id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  const metadataRole = String(user.app_metadata?.role ?? user.user_metadata?.role ?? '').toLowerCase();
  const role = String(profile?.role ?? metadataRole).toLowerCase();
  const active = profile?.active !== false && profile?.disabled !== true;

  if (!active || !ALLOWED_ROLES.has(role)) {
    throw new Error('Permissao obrigatoria: medico ou gestao.');
  }

  return { user, role };
}
