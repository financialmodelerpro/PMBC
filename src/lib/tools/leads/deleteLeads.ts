/**
 * Deleting tool leads from the admin (since 2026-09-22): a whole person (every valuation under one
 * email) or a single valuation.
 *
 * A valuation's email events, versions, booking links and resume links are `tool_lead_events` rows,
 * which the foreign key deletes with the lead (ON DELETE CASCADE, migration 077). Reminders have no
 * row of their own: the daily run works them out from the person's latest valuation, so a person with
 * no valuations left gets none.
 *
 * Deleting one valuation while others remain needs one step more. The reminder, unsubscribe and
 * booked events belong to the person, not to the valuation they happen to be stored against. Left to
 * cascade, deleting the valuation a reminder was recorded on would let the next run send that
 * reminder again, and deleting the one an unsubscribe was recorded on would start reminders to
 * someone who asked for them to stop. So those events move to the person's newest remaining
 * valuation first (`planLeadDeletion`).
 */

import { toolsDb } from '../db';
import { BOOKED_EVENT, REMINDER_EVENT, UNSUBSCRIBED_EVENT } from './reminders';

/** Events that describe the person rather than one valuation, carried to a remaining valuation. */
export const PERSON_EVENTS = [REMINDER_EVENT, UNSUBSCRIBED_EVENT, BOOKED_EVENT] as const;

/** At most this many emails or valuations in one request. */
export const DELETE_LIMIT = 200;

export type DeletionRow = { id: string; email: string; created_at: string };

export type DeletionPlan = {
  /** Every lead id to delete. */
  deleteIds: string[];
  /** Per email that keeps valuations: the deleted ids whose person events move, and where to. */
  carry: { email: string; fromIds: string[]; toId: string }[];
};

const key = (email: string) => email.trim().toLowerCase();

/**
 * Pure. `rows` holds every valuation of every affected email. Ids and emails that match nothing are
 * ignored, so a double click or a stale page deletes nothing twice.
 */
export function planLeadDeletion(rows: DeletionRow[], req: { emails?: string[]; ids?: string[] }): DeletionPlan {
  const emails = new Set((req.emails ?? []).map(key));
  const ids = new Set(req.ids ?? []);
  const doomed = new Set(rows.filter((r) => emails.has(key(r.email)) || ids.has(r.id)).map((r) => r.id));

  const byEmail = new Map<string, DeletionRow[]>();
  for (const r of rows) byEmail.set(key(r.email), [...(byEmail.get(key(r.email)) ?? []), r]);

  const carry: DeletionPlan['carry'] = [];
  for (const [email, list] of byEmail) {
    const fromIds = list.filter((r) => doomed.has(r.id)).map((r) => r.id);
    const kept = list.filter((r) => !doomed.has(r.id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (fromIds.length && kept.length) carry.push({ email, fromIds, toId: kept[0].id });
  }
  return { deleteIds: rows.filter((r) => doomed.has(r.id)).map((r) => r.id), carry };
}

/** An exact, case-insensitive match for `ilike`, with its wildcards escaped. */
function exactPattern(email: string): string {
  return key(email).replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Columns kept in the audit row: who and what was removed, never the access token or the IP hash. */
const AUDIT_COLUMNS =
  'id, created_at, tool_slug, is_test, data_version, name, email, company, purpose, deal_size_band, below_minimum, country, currency, industry, inputs, equity_low, equity_mid, equity_high, wacc, consent_given, consent_at, follow_up_consent, status, notes, email_status, booking_clicks';

export type DeletedLead = Record<string, unknown> & { id: string; email: string };

export type DeletionOutcome = {
  deleted: DeletedLead[];
  /** Events removed with each lead, by lead id. */
  eventsDeleted: Record<string, number>;
  /** Person events moved, by the lead they came from: the id they now sit on. */
  carriedTo: Record<string, string>;
};

/** Deletes what the request names, returning the removed rows for the audit log. */
export async function deleteToolLeads(req: { emails?: string[]; ids?: string[] }): Promise<DeletionOutcome> {
  const db = toolsDb();
  const byId = new Map<string, DeletedLead>();
  const add = (data: unknown) => {
    for (const r of (data ?? []) as DeletedLead[]) byId.set(r.id, r);
  };

  for (const email of req.emails ?? []) {
    const { data, error } = await db.from('tool_leads').select(AUDIT_COLUMNS).ilike('email', exactPattern(email));
    if (error) throw new Error(error.message);
    add(data);
  }
  if (req.ids?.length) {
    const { data, error } = await db.from('tool_leads').select(AUDIT_COLUMNS).in('id', req.ids);
    if (error) throw new Error(error.message);
    add(data);
    // The person's other valuations, so person events have somewhere to go.
    for (const email of new Set((data ?? []).map((r: { email: string }) => key(r.email)))) {
      const { data: more, error: moreError } = await db.from('tool_leads').select(AUDIT_COLUMNS).ilike('email', exactPattern(email));
      if (moreError) throw new Error(moreError.message);
      add(more);
    }
  }

  const rows = [...byId.values()] as unknown as DeletionRow[];
  const plan = planLeadDeletion(rows, req);
  const outcome: DeletionOutcome = { deleted: [], eventsDeleted: {}, carriedTo: {} };
  if (!plan.deleteIds.length) return outcome;

  for (const c of plan.carry) {
    const { error } = await db.from('tool_lead_events').update({ lead_id: c.toId }).in('lead_id', c.fromIds).in('event_type', [...PERSON_EVENTS]);
    if (error) throw new Error(`could not keep reminder history: ${error.message}`);
    for (const id of c.fromIds) outcome.carriedTo[id] = c.toId;
  }

  for (let k = 0; k < plan.deleteIds.length; k += 100) {
    const chunk = plan.deleteIds.slice(k, k + 100);
    const { data: ev } = await db.from('tool_lead_events').select('lead_id').in('lead_id', chunk);
    for (const e of (ev ?? []) as { lead_id: string }[]) outcome.eventsDeleted[e.lead_id] = (outcome.eventsDeleted[e.lead_id] ?? 0) + 1;
    const { error } = await db.from('tool_leads').delete().in('id', chunk);
    if (error) throw new Error(error.message);
    for (const id of chunk) outcome.deleted.push(byId.get(id)!);
  }
  return outcome;
}
