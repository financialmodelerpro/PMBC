/**
 * The Signal Inbox (Unit 2.1, 2026-09-23). Server only.
 *
 * Signals arrive by hand, from the daily feed (Unit 2.6) or from a pilot
 * import (Unit 2.5), always with a real evidence link. Each is checked for a
 * duplicate on the way in and flagged, never blocked. Triage turns a signal
 * into a prospect (convert: a company, created or chosen, and a lead), ties it
 * to an existing company or lead (attach), or dismisses it with a reason.
 * Every step logs an activity row and rescores the company.
 */

import { isMissingSchema } from '@/lib/tools/db';

import { logActivity } from './activity';
import type { WriteResult } from './api';
import { growthDb } from './db';
import type { Actor } from './kb';
import { TRIGGER_TYPES, type ActorType, type GrowthSignal, type TriggerType } from './model';
import { createCompany, createLead, getCompany, rescoreCompany } from './prospects';
import { DUPLICATE_WINDOW_DAYS, evidenceKey, findDuplicate, type SignalCreateInput, type SignalFilters, type SignalOrigin, type SignalTriage } from './signalsModel';
import { insertTolerant, updateTolerant } from './tolerant';

/** The signal row with the columns migration 088 adds (absent until it runs). */
export type InboxSignal = GrowthSignal & {
  origin?: SignalOrigin;
  evidence_key?: string | null;
  duplicate_of?: string | null;
  triaged_at?: string | null;
  triaged_by_name?: string | null;
  feed_run_id?: string | null;
};

const SIGNAL_088_COLUMNS = ['origin', 'evidence_key', 'duplicate_of', 'triaged_at', 'triaged_by_name', 'feed_run_id'] as const;

export const triggerLabel = (t: string) => TRIGGER_TYPES.find((x) => x.value === t)?.label ?? t;

export type SignalListRow = InboxSignal & { companyLabel: string | null };

export async function listSignals(f: SignalFilters, limit = 300): Promise<{ rows: SignalListRow[]; missingTable: boolean; error: string | null; counts: Record<string, number> }> {
  const counts: Record<string, number> = { new: 0, converted: 0, attached: 0, dismissed: 0 };
  try {
    let q = growthDb().from('growth_signals').select('*').order('signal_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
    if (f.status !== 'all') q = q.eq('status', f.status);
    if (f.trigger) q = q.eq('trigger_type', f.trigger);
    if (f.origin) q = q.eq('origin', f.origin);
    if (f.from) q = q.gte('signal_date', f.from);
    if (f.to) q = q.lte('signal_date', f.to);
    if (f.q) {
      const like = `%${f.q.replace(/[\\%_,()]/g, ' ')}%`;
      q = q.or(`summary.ilike.${like},company_name.ilike.${like}`);
    }
    if (f.dup) q = q.not('duplicate_of', 'is', null);
    if (!f.includeTest) q = q.eq('is_test', false);
    let countQ = growthDb().from('growth_signals').select('status');
    if (!f.includeTest) countQ = countQ.eq('is_test', false);
    const [{ data, error }, countRes] = await Promise.all([q, countQ.limit(5000)]);
    for (const r of (countRes.data ?? []) as { status: string }[]) counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (error) return { rows: [], missingTable: isMissingSchema(error), error: isMissingSchema(error) ? null : error.message, counts };
    const rows = (data ?? []) as InboxSignal[];
    const ids = [...new Set(rows.map((r) => r.company_id).filter((x): x is string => Boolean(x)))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: cs } = await growthDb().from('growth_companies').select('id, name').in('id', ids);
      for (const c of (cs ?? []) as { id: string; name: string }[]) names.set(c.id, c.name);
    }
    return { rows: rows.map((r) => ({ ...r, companyLabel: (r.company_id && names.get(r.company_id)) || r.company_name })), missingTable: false, error: null, counts };
  } catch (err) {
    return { rows: [], missingTable: false, error: err instanceof Error ? err.message : 'load failed', counts };
  }
}

export async function getSignal(id: string): Promise<InboxSignal | null> {
  const { data } = await growthDb().from('growth_signals').select('*').eq('id', id).maybeSingle();
  return (data as InboxSignal | null) ?? null;
}

/** Earlier signals that could be duplicates: same evidence key, or same trigger type close in date. */
async function duplicateCandidates(input: { trigger_type: TriggerType; signal_date: string; evidence_url: string }): Promise<InboxSignal[]> {
  const day = Date.parse(`${input.signal_date}T00:00:00Z`);
  const from = new Date(day - DUPLICATE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(day + DUPLICATE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const key = evidenceKey(input.evidence_url);
  const [byType, byKey, byUrl] = await Promise.all([
    growthDb().from('growth_signals').select('*').eq('trigger_type', input.trigger_type).gte('signal_date', from).lte('signal_date', to).limit(300),
    key ? growthDb().from('growth_signals').select('*').eq('evidence_key', key).limit(5) : Promise.resolve({ data: [], error: null }),
    growthDb().from('growth_signals').select('*').eq('evidence_url', input.evidence_url.trim()).limit(5),
  ]);
  const all = new Map<string, InboxSignal>();
  for (const r of [...(byType.data ?? []), ...(byKey.error ? [] : byKey.data ?? []), ...(byUrl.data ?? [])] as InboxSignal[]) {
    // Before 088 there is no stored key: derive it so an identical link still matches.
    all.set(r.id, { ...r, evidence_key: r.evidence_key ?? evidenceKey(r.evidence_url) });
  }
  return [...all.values()];
}

/** The earlier signal a new one would duplicate, if any. The daily feed skips these. */
export async function existingDuplicate(input: { company_id: string | null; company_name: string | null; trigger_type: TriggerType; signal_date: string; evidence_url: string }): Promise<{ id: string; why: string } | null> {
  return findDuplicate(input, await duplicateCandidates(input));
}

export type CreateSignalOpts = {
  origin?: SignalOrigin;
  feedRunId?: string | null;
  isTest?: boolean;
  actorType?: ActorType;
  actorId?: string | null;
};

export async function createSignal(input: SignalCreateInput, actor: Actor | null, opts: CreateSignalOpts = {}): Promise<WriteResult<InboxSignal & { duplicateWhy: string | null }>> {
  let companyName = input.company_name?.trim() || null;
  if (input.company_id) {
    const company = await getCompany(input.company_id);
    if (!company) return { ok: false, status: 422, error: 'That company no longer exists' };
    companyName = companyName ?? company.name;
  }
  const dup = findDuplicate(
    { company_id: input.company_id ?? null, company_name: companyName, trigger_type: input.trigger_type, signal_date: input.signal_date, evidence_url: input.evidence_url },
    await duplicateCandidates(input),
  );
  const row: Record<string, unknown> = {
    trigger_type: input.trigger_type,
    signal_date: input.signal_date,
    summary: input.summary.trim(),
    evidence_url: input.evidence_url.trim(),
    source_name: input.source_name?.trim() || null,
    company_id: input.company_id ?? null,
    company_name: companyName,
    is_test: Boolean(opts.isTest),
    origin: opts.origin ?? 'manual',
    evidence_key: evidenceKey(input.evidence_url),
    duplicate_of: dup?.id ?? null,
    feed_run_id: opts.feedRunId ?? null,
  };
  const { data, error } = await insertTolerant<InboxSignal>('growth_signals', row, SIGNAL_088_COLUMNS);
  if (error || !data) {
    if (error && isMissingSchema(error)) return { ok: false, status: 503, error: 'The signals table is missing. Apply 083_growth_core.sql.' };
    if (error?.code === '23514') return { ok: false, status: 422, error: 'The database refused the signal: check the evidence link and the date' };
    return { ok: false, status: 500, error: error?.message ?? 'Save failed' };
  }
  const who = opts.actorType ?? (actor ? 'admin' : 'system');
  await logActivity({
    actorType: who,
    actorId: opts.actorId ?? actor?.id ?? null,
    action: 'signal.created',
    summary: `${triggerLabel(data.trigger_type)} signal for ${companyName ?? 'a company'}${dup ? ' (flagged as a possible duplicate)' : ''}`,
    companyId: data.company_id,
    signalId: data.id,
    isTest: data.is_test,
    metadata: { origin: opts.origin ?? 'manual', evidence_url: data.evidence_url, duplicate_of: dup?.id ?? null, duplicate_why: dup?.why ?? null },
  });
  if (data.company_id) await rescoreCompany(data.company_id, { actor });
  return { ok: true, value: { ...data, duplicateWhy: dup?.why ?? null } };
}

/** Converts, attaches, dismisses or reopens a signal. */
export async function triageSignal(id: string, t: SignalTriage, actor: Actor): Promise<WriteResult<InboxSignal>> {
  const signal = await getSignal(id);
  if (!signal) return { ok: false, status: 404, error: 'Signal not found' };
  const triaged = { triaged_at: new Date().toISOString(), triaged_by_name: actor.name };
  let patch: Record<string, unknown>;
  let summary: string;
  let companyId: string | null = signal.company_id;
  let leadId: string | null = signal.lead_id;

  if (t.action === 'convert') {
    if (signal.status === 'converted') return { ok: false, status: 409, error: 'This signal is already converted' };
    if (t.company_id) {
      const company = await getCompany(t.company_id);
      if (!company) return { ok: false, status: 422, error: 'That company no longer exists' };
      companyId = company.id;
    } else if (!companyId) {
      const name = t.company?.name?.trim() || signal.company_name?.trim();
      if (!name) return { ok: false, status: 422, error: 'Name the company to create' };
      const created = await createCompany({ name, website_domain: t.company?.website_domain ?? null, sector: t.company?.sector ?? null, city: t.company?.city ?? null, country: t.company?.country ?? null, source: signal.origin === 'import' ? 'pilot' : 'outbound' }, actor, { isTest: signal.is_test });
      if (!created.ok) return created;
      companyId = created.value.id;
    }
    const company = await getCompany(companyId!);
    const lead = await createLead(
      companyId,
      { title: t.lead_title?.trim() || `${company?.name ?? signal.company_name ?? 'Prospect'}: ${triggerLabel(signal.trigger_type).toLowerCase()}`, source: signal.origin === 'import' ? 'pilot' : 'outbound', source_ref: `signal:${signal.id}` },
      actor,
      { isTest: signal.is_test },
    );
    if (!lead.ok) return lead;
    leadId = lead.value.id;
    patch = { status: 'converted', company_id: companyId, lead_id: leadId, dismissed_reason: null, ...triaged };
    summary = `Signal converted into the lead "${lead.value.title}"`;
  } else if (t.action === 'attach') {
    const company = await getCompany(t.company_id);
    if (!company) return { ok: false, status: 422, error: 'That company no longer exists' };
    companyId = company.id;
    leadId = t.lead_id ?? null;
    if (leadId) {
      const { data: lead } = await growthDb().from('growth_leads').select('id, company_id').eq('id', leadId).maybeSingle();
      if (!lead) return { ok: false, status: 422, error: 'That lead no longer exists' };
      if ((lead as { company_id: string | null }).company_id !== companyId) return { ok: false, status: 422, error: 'That lead belongs to another company' };
    }
    patch = { status: 'attached', company_id: companyId, lead_id: leadId, dismissed_reason: null, ...triaged };
    summary = `Signal attached to ${company.name}${leadId ? ' and one of its leads' : ''}`;
  } else if (t.action === 'dismiss') {
    patch = { status: 'dismissed', dismissed_reason: t.reason, ...triaged };
    summary = `Signal dismissed: ${t.reason}`;
  } else if (t.action === 'reopen') {
    patch = { status: 'new', dismissed_reason: null, ...triaged };
    summary = 'Signal reopened for triage';
  } else {
    patch = { duplicate_of: null };
    summary = 'Marked as not a duplicate';
  }

  const { data, error } = await updateTolerant<InboxSignal>('growth_signals', id, patch, SIGNAL_088_COLUMNS);
  if (error || !data) return { ok: false, status: error?.code === '23514' ? 422 : 500, error: error?.code === '23514' ? 'The database refused that change' : error?.message ?? 'Save failed' };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: `signal.${t.action}`, summary, companyId, leadId, signalId: id, isTest: signal.is_test, metadata: { from: signal.status, to: data.status } });
  const touched = new Set([signal.company_id, companyId].filter((x): x is string => Boolean(x)));
  for (const c of touched) await rescoreCompany(c, { actor });
  return { ok: true, value: data };
}
