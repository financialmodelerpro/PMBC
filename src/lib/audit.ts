import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/types/database';

export type AuditEntry = {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Json;
  /** Row state before the mutation. Null for creates. */
  beforeValue?: Json | null;
  /** Row state after the mutation. Null for deletes. */
  afterValue?: Json | null;
  /** Optional operator-supplied context. Null unless the caller has one. */
  reason?: string | null;
};

/**
 * Append one row to audit_log.
 *
 * Never throws and never blocks the caller's mutation. An audit row records
 * work that has already happened, so failing the request because the record
 * could not be written would turn a logging problem into a data problem.
 * Errors are swallowed deliberately.
 *
 * Tolerates a database where migration 032 has not run: if the insert is
 * rejected because the diff columns do not exist, it retries without them so
 * the pre-032 audit behaviour keeps working.
 */
export async function writeAudit(
  supabase: SupabaseClient<Database>,
  entry: AuditEntry,
): Promise<void> {
  const base = {
    admin_id: entry.adminId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  };

  try {
    const { error } = await supabase.from('audit_log').insert({
      ...base,
      before_value: entry.beforeValue ?? null,
      after_value: entry.afterValue ?? null,
      reason: entry.reason ?? null,
    });
    if (!error) return;

    // Most likely cause is migration 032 not being applied. Fall back rather
    // than losing the audit row entirely.
    await supabase.from('audit_log').insert(base);
  } catch {
    // Deliberately silent. See the note above.
  }
}

/**
 * Read one row for use as an audit before-value.
 *
 * Returns null on any failure, including a missing table, so a caller can
 * inline it without a try/catch and without risking the mutation it is about
 * to perform.
 *
 * Loosely typed on purpose: callers pass a dynamic table name (the collection
 * API serves six tables from one factory), which the generated Database types
 * cannot express.
 */
export async function snapshotRow(
  supabase: SupabaseClient<Database>,
  table: string,
  idColumn: string,
  idValue: string,
): Promise<Json | null> {
  try {
    const loose = supabase as unknown as SupabaseClient;
    const { data, error } = await loose
      .from(table)
      .select('*')
      .eq(idColumn, idValue)
      .maybeSingle();
    if (error) return null;
    return (data ?? null) as Json | null;
  } catch {
    return null;
  }
}

/**
 * Drop noisy keys from a snapshot before storing it as a diff.
 *
 * `updated_at` changes on every write, so leaving it in would make every diff
 * show at least one difference and train the reader to ignore them.
 */
export function forDiff(row: Json | null | undefined): Json | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return (row ?? null) as Json | null;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (k === 'updated_at') continue;
    out[k] = v;
  }
  return out as Json;
}
