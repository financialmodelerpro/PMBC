/**
 * The suppression list and the one check every send must call (Unit 1.4,
 * 2026-09-22). Server only, apart from the pure helpers at the top.
 *
 * `checkSuppression(email)` answers from three places on every call:
 *   1. live entries in growth_suppressions, for the email or any of its domains;
 *   2. the valuation tool's unsubscribes, read live from tool_lead_events, so an
 *      unsubscribe made after the last import is still caught;
 *   3. Growth contacts with that email marked opted out or do not contact.
 * Suppression always wins, and the check fails closed: if any source cannot be
 * read, the email is treated as suppressed.
 *
 * The valuation tool's tables are only read here, never written.
 */

import { toolsDb } from '@/lib/tools/db';
import { UNSUBSCRIBED_EVENT } from '@/lib/tools/leads/reminders';

import { growthDb } from './db';
import type { Actor } from './kb';
import { normaliseDomain, normaliseEmail } from './model';

export type SuppressionKind = 'email' | 'domain';
export type SuppressionSource = 'manual' | 'valuation_unsubscribe' | 'growth_contact';

export type Suppression = {
  id: string;
  created_at: string;
  is_test: boolean;
  kind: SuppressionKind;
  value: string;
  reason: string;
  source: SuppressionSource;
  source_ref: string | null;
  added_by_name: string | null;
  removed_at: string | null;
  removed_by_name: string | null;
  removed_reason: string | null;
};

const EMAIL = /^[^@\s]+@[^@\s]+$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** A value as the table stores it, or null when it is not a valid email or domain. */
export function normaliseSuppressionValue(kind: SuppressionKind, input: string): string | null {
  if (kind === 'email') {
    const e = normaliseEmail(input);
    return e && EMAIL.test(e) ? e : null;
  }
  const d = normaliseDomain(input.replace(/^.*@/, ''));
  return d && DOMAIN.test(d) ? d : null;
}

/** The domain of an email and each parent domain: a@x.acme.com.sa gives x.acme.com.sa, acme.com.sa, com.sa. */
export function domainsOf(email: string): string[] {
  const host = email.split('@')[1] ?? '';
  const labels = host.split('.').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < labels.length - 1; i++) out.push(labels.slice(i).join('.'));
  return out;
}

export type SuppressionHit = { source: SuppressionSource | 'check_failed'; match: string; reason: string; since: string | null };
export type SuppressionResult = { email: string; suppressed: boolean; reasons: SuppressionHit[] };

/** Where the check reads from. Injected by the verifier; the defaults read the live database. */
export type SuppressionSources = {
  list(email: string, domains: string[]): Promise<SuppressionHit[]>;
  toolUnsubscribes(email: string): Promise<SuppressionHit[]>;
  contactOptOuts(email: string): Promise<SuppressionHit[]>;
};

export const liveSources: SuppressionSources = {
  async list(email, domains) {
    // Two plain filters rather than one or() string, so no value needs quoting.
    const cols = 'kind, value, reason, source, created_at';
    const [byEmail, byDomain] = await Promise.all([
      growthDb().from('growth_suppressions').select(cols).is('removed_at', null).eq('kind', 'email').eq('value', email),
      domains.length ? growthDb().from('growth_suppressions').select(cols).is('removed_at', null).eq('kind', 'domain').in('value', domains) : Promise.resolve({ data: [], error: null }),
    ]);
    const error = byEmail.error ?? byDomain.error;
    if (error) throw new Error(`suppression list: ${error.message}`);
    return ([...(byEmail.data ?? []), ...(byDomain.data ?? [])] as Pick<Suppression, 'kind' | 'value' | 'reason' | 'source' | 'created_at'>[]).map((r) => ({
      source: r.source,
      match: `${r.kind} ${r.value}`,
      reason: r.reason,
      since: r.created_at,
    }));
  },
  async toolUnsubscribes(email) {
    const { data: leads, error } = await toolsDb().from('tool_leads').select('id').ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`));
    if (error) throw new Error(`valuation leads: ${error.message}`);
    const ids = (leads ?? []).map((l: { id: string }) => l.id);
    if (!ids.length) return [];
    const { data: events, error: evErr } = await toolsDb().from('tool_lead_events').select('created_at').eq('event_type', UNSUBSCRIBED_EVENT).in('lead_id', ids).order('created_at').limit(1);
    if (evErr) throw new Error(`valuation unsubscribes: ${evErr.message}`);
    return (events ?? []).map((e: { created_at: string }) => ({ source: 'valuation_unsubscribe' as const, match: `email ${email}`, reason: 'Unsubscribed from the valuation tool reminders', since: e.created_at }));
  },
  async contactOptOuts(email) {
    const { data, error } = await growthDb().from('growth_contacts').select('consent_status, updated_at').eq('email', email).in('consent_status', ['opted_out', 'do_not_contact']);
    if (error) throw new Error(`growth contacts: ${error.message}`);
    return (data ?? []).map((c: { consent_status: string; updated_at: string }) => ({
      source: 'growth_contact' as const,
      match: `email ${email}`,
      reason: c.consent_status === 'opted_out' ? 'Growth contact opted out' : 'Growth contact marked do not contact',
      since: c.updated_at,
    }));
  },
};

/**
 * Whether an email may be contacted. Every future send calls this first and
 * sends only when `suppressed` is false. An address that cannot be read as an
 * email is suppressed.
 */
export async function checkSuppression(rawEmail: string, sources: SuppressionSources = liveSources): Promise<SuppressionResult> {
  const email = normaliseEmail(rawEmail);
  if (!email || !EMAIL.test(email)) {
    return { email: rawEmail, suppressed: true, reasons: [{ source: 'check_failed', match: rawEmail, reason: 'Not a valid email address', since: null }] };
  }
  const domains = domainsOf(email);
  const settled = await Promise.allSettled([sources.list(email, domains), sources.toolUnsubscribes(email), sources.contactOptOuts(email)]);
  const reasons: SuppressionHit[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') reasons.push(...s.value);
    else reasons.push({ source: 'check_failed', match: email, reason: `Could not check: ${s.reason instanceof Error ? s.reason.message : 'unknown error'}`, since: null });
  }
  return { email, suppressed: reasons.length > 0, reasons };
}

const COLUMNS = 'id, created_at, is_test, kind, value, reason, source, source_ref, added_by_name, removed_at, removed_by_name, removed_reason';

export async function listSuppressions(opts: { includeRemoved?: boolean; includeTest?: boolean } = {}): Promise<{ rows: Suppression[]; missingTable: boolean; error: string | null }> {
  try {
    let q = growthDb().from('growth_suppressions').select(COLUMNS).order('created_at', { ascending: false }).limit(2000);
    if (!opts.includeRemoved) q = q.is('removed_at', null);
    if (!opts.includeTest) q = q.eq('is_test', false);
    const { data, error } = await q;
    if (error) {
      const missing = /growth_suppressions|schema cache|does not exist/i.test(error.message ?? '') || error.code === 'PGRST205';
      return { rows: [], missingTable: missing, error: missing ? null : error.message };
    }
    return { rows: (data ?? []) as Suppression[], missingTable: false, error: null };
  } catch (err) {
    return { rows: [], missingTable: false, error: err instanceof Error ? err.message : 'load failed' };
  }
}

export type SuppressionWrite = { ok: true; row: Suppression } | { ok: false; status: number; error: string };

export async function addSuppression(
  input: { kind: SuppressionKind; value: string; reason: string; source?: SuppressionSource; sourceRef?: string | null },
  actor: Actor | null,
  opts: { isTest?: boolean } = {},
): Promise<SuppressionWrite> {
  const value = normaliseSuppressionValue(input.kind, input.value);
  if (!value) return { ok: false, status: 422, error: input.kind === 'email' ? 'Enter a valid email address' : 'Enter a valid domain, for example example.com' };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, status: 422, error: 'Give a reason' };
  const { data, error } = await growthDb()
    .from('growth_suppressions')
    .insert({
      kind: input.kind,
      value,
      reason,
      source: input.source ?? 'manual',
      source_ref: input.sourceRef ?? null,
      added_by: actor?.id ?? null,
      added_by_name: actor?.name ?? null,
      is_test: Boolean(opts.isTest),
    })
    .select(COLUMNS)
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, status: 409, error: `${value} is already suppressed` };
    if (error.code === '23514') return { ok: false, status: 422, error: 'The database refused that value' };
    return { ok: false, status: 500, error: error.message ?? 'Save failed' };
  }
  return { ok: true, row: data as Suppression };
}

/** Removal keeps the row as history, with who, when and why. */
export async function removeSuppression(id: string, reason: string, actor: Actor): Promise<SuppressionWrite> {
  if (!reason.trim()) return { ok: false, status: 422, error: 'Give a reason for removing it' };
  const { data, error } = await growthDb()
    .from('growth_suppressions')
    .update({ removed_at: new Date().toISOString(), removed_by: actor.id, removed_by_name: actor.name, removed_reason: reason.trim() })
    .eq('id', id)
    .is('removed_at', null)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message ?? 'Remove failed' };
  if (!data) return { ok: false, status: 404, error: 'No live entry with that id' };
  return { ok: true, row: data as Suppression };
}

export type ImportResult = { found: { valuation: number; contacts: number }; added: number; alreadySuppressed: number; errors: string[] };

/**
 * Brings existing opt-outs into the list: valuation tool unsubscribes (real
 * leads only) and Growth contacts opted out or marked do not contact. Safe to
 * run again: an email already suppressed is skipped. The live check does not
 * depend on this having run.
 */
export async function importOptOuts(actor: Actor): Promise<ImportResult> {
  const result: ImportResult = { found: { valuation: 0, contacts: 0 }, added: 0, alreadySuppressed: 0, errors: [] };
  const wanted = new Map<string, { source: SuppressionSource; ref: string; reason: string }>();

  const { data: events, error: evErr } = await toolsDb().from('tool_lead_events').select('lead_id').eq('event_type', UNSUBSCRIBED_EVENT);
  if (evErr) result.errors.push(`valuation unsubscribes: ${evErr.message}`);
  const leadIds = [...new Set((events ?? []).map((e: { lead_id: string }) => e.lead_id))];
  for (let k = 0; k < leadIds.length; k += 200) {
    const { data: leads, error } = await toolsDb().from('tool_leads').select('id, email').in('id', leadIds.slice(k, k + 200)).eq('is_test', false);
    if (error) result.errors.push(`valuation leads: ${error.message}`);
    for (const l of (leads ?? []) as { id: string; email: string }[]) {
      const e = normaliseEmail(l.email);
      if (e && !wanted.has(e)) wanted.set(e, { source: 'valuation_unsubscribe', ref: l.id, reason: 'Unsubscribed from the valuation tool reminders' });
    }
  }
  result.found.valuation = wanted.size;

  const { data: contacts, error: cErr } = await growthDb().from('growth_contacts').select('id, email, consent_status').in('consent_status', ['opted_out', 'do_not_contact']).eq('is_test', false).not('email', 'is', null);
  if (cErr) result.errors.push(`growth contacts: ${cErr.message}`);
  for (const c of (contacts ?? []) as { id: string; email: string; consent_status: string }[]) {
    result.found.contacts++;
    const e = normaliseEmail(c.email);
    if (e && !wanted.has(e)) wanted.set(e, { source: 'growth_contact', ref: c.id, reason: c.consent_status === 'opted_out' ? 'Growth contact opted out' : 'Growth contact marked do not contact' });
  }

  for (const [email, w] of wanted) {
    const r = await addSuppression({ kind: 'email', value: email, reason: w.reason, source: w.source, sourceRef: w.ref }, actor);
    if (r.ok) result.added++;
    else if (r.status === 409) result.alreadySuppressed++;
    else result.errors.push(`${email}: ${r.error}`);
  }
  return result;
}
