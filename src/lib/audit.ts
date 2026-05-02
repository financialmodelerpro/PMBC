import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database';

export type AuditEntry = {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Json;
};

export async function writeAudit(
  supabase: SupabaseClient<Database>,
  entry: AuditEntry,
): Promise<void> {
  await supabase.from('audit_log').insert({
    admin_id: entry.adminId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  });
}
