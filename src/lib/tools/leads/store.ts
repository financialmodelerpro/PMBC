/**
 * Supabase access for tool leads and their events.
 *
 * Every function tolerates the tables being absent (migration 077 not yet
 * applied) and reports it as `missing_table` rather than throwing.
 */

import { isMissingSchema, toolsDb, type ToolLeadEventRow, type ToolLeadRow } from '../db';
import type { LeadStore } from './valuation';

export const supabaseLeadStore: LeadStore = {
  async countSince(ipHash, sinceIso) {
    try {
      const { count, error } = await toolsDb()
        .from('tool_leads')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', sinceIso);
      return error ? null : (count ?? 0);
    } catch {
      return null;
    }
  },
  async insert(row) {
    try {
      const { data, error } = await toolsDb().from('tool_leads').insert(row).select('id').single();
      if (error || !data) {
        return { ok: false, reason: isMissingSchema(error) ? 'missing_table' : 'error', message: error?.message };
      }
      return { ok: true, id: (data as { id: string }).id };
    } catch (err) {
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'insert failed' };
    }
  },
};

export type EventInsert = Omit<ToolLeadEventRow, 'id' | 'created_at' | 'occurred_at' | 'payload' | 'dedupe_key' | 'email_kind' | 'message_id' | 'link' | 'detail'> &
  Partial<Pick<ToolLeadEventRow, 'occurred_at' | 'payload' | 'dedupe_key' | 'email_kind' | 'message_id' | 'link' | 'detail'>>;

/** Inserts one event. A duplicate `dedupe_key` is reported, not thrown. */
export async function insertLeadEvent(event: EventInsert): Promise<'inserted' | 'duplicate' | 'failed'> {
  try {
    const { error } = await toolsDb().from('tool_lead_events').insert(event);
    if (!error) return 'inserted';
    if (error.code === '23505') return 'duplicate';
    console.error('[tool-leads] event insert failed:', error.message);
    return 'failed';
  } catch (err) {
    console.error('[tool-leads] event insert threw:', err);
    return 'failed';
  }
}

export async function updateLead(id: string, patch: Partial<ToolLeadRow>): Promise<boolean> {
  try {
    const { error } = await toolsDb().from('tool_leads').update(patch).eq('id', id);
    if (error) console.error('[tool-leads] update failed:', error.message);
    return !error;
  } catch (err) {
    console.error('[tool-leads] update threw:', err);
    return false;
  }
}

export async function getLead(id: string): Promise<{ lead: ToolLeadRow | null; missingTable: boolean }> {
  try {
    const { data, error } = await toolsDb().from('tool_leads').select('*').eq('id', id).maybeSingle();
    if (error) return { lead: null, missingTable: isMissingSchema(error) };
    return { lead: (data as ToolLeadRow) ?? null, missingTable: false };
  } catch {
    return { lead: null, missingTable: false };
  }
}

export async function getLeadByToken(token: string): Promise<ToolLeadRow | null> {
  if (!token || token.length < 20) return null;
  try {
    const { data } = await toolsDb().from('tool_leads').select('*').eq('access_token', token).maybeSingle();
    return (data as ToolLeadRow) ?? null;
  } catch {
    return null;
  }
}

export async function getLeadEvents(leadId: string): Promise<ToolLeadEventRow[]> {
  try {
    const { data } = await toolsDb()
      .from('tool_lead_events')
      .select('*')
      .eq('lead_id', leadId)
      .order('occurred_at', { ascending: false })
      .limit(500);
    return (data ?? []) as ToolLeadEventRow[];
  } catch {
    return [];
  }
}
