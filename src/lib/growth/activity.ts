/**
 * Writing and reading the Growth activity log (from Phase 2, 2026-09-23).
 * Server only.
 *
 * growth_activity is append-only (migration 083): rows are inserted, never
 * updated, and only test rows can be deleted. Every change the Growth Engine
 * makes to a company, contact, lead or signal logs one row here, with the
 * actor (admin, system or ai) and a plain-words summary. The timeline on a
 * company page is this table, oldest first, in insertion order (created_at
 * then seq).
 */

import { growthDb } from './db';
import type { ActorType } from './model';

export type ActivityInput = {
  action: string;
  summary: string;
  actorType: ActorType;
  actorId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  signalId?: string | null;
  metadata?: Record<string, unknown>;
  isTest?: boolean;
  /** Only for imported history: when the recorded event happened. */
  occurredAt?: string | null;
};

/** Appends one activity row. Returns false (and logs) when it cannot be written; callers do not fail on it. */
export async function logActivity(a: ActivityInput): Promise<boolean> {
  const row: Record<string, unknown> = {
    is_test: Boolean(a.isTest),
    company_id: a.companyId ?? null,
    contact_id: a.contactId ?? null,
    lead_id: a.leadId ?? null,
    signal_id: a.signalId ?? null,
    actor_type: a.actorType,
    actor_id: a.actorId ?? null,
    action: a.action,
    summary: a.summary.slice(0, 1000),
    metadata: a.metadata ?? {},
  };
  if (a.occurredAt) row.created_at = a.occurredAt;
  const { error } = await growthDb().from('growth_activity').insert(row);
  if (error) {
    console.error('[growth-activity] not written:', a.action, error.message);
    return false;
  }
  return true;
}

export type TimelineRow = {
  id: string;
  created_at: string;
  seq: number | null;
  actor_type: string;
  actor_id: string | null;
  action: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  company_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  signal_id: string | null;
  is_test: boolean;
};

const COLS = 'id, created_at, seq, actor_type, actor_id, action, summary, metadata, company_id, contact_id, lead_id, signal_id, is_test';

/**
 * Everything that happened to a company, its contacts, leads and signals,
 * oldest first. `ids` lets the caller pass the related records it already has.
 */
export async function companyTimeline(companyId: string, ids: { contactIds?: string[]; leadIds?: string[]; signalIds?: string[] } = {}, limit = 500): Promise<TimelineRow[]> {
  const db = growthDb();
  const queries = [db.from('growth_activity').select(COLS).eq('company_id', companyId).limit(limit)];
  if (ids.contactIds?.length) queries.push(db.from('growth_activity').select(COLS).in('contact_id', ids.contactIds).limit(limit));
  if (ids.leadIds?.length) queries.push(db.from('growth_activity').select(COLS).in('lead_id', ids.leadIds).limit(limit));
  if (ids.signalIds?.length) queries.push(db.from('growth_activity').select(COLS).in('signal_id', ids.signalIds).limit(limit));
  const results = await Promise.all(queries);
  const seen = new Map<string, TimelineRow>();
  for (const r of results) for (const row of (r.data ?? []) as TimelineRow[]) seen.set(row.id, row);
  return sortTimeline([...seen.values()]);
}

/** Oldest first; within the same instant, in insertion order. */
export function sortTimeline<T extends { created_at: string; seq: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const t = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (t !== 0) return t;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });
}
