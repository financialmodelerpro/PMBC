/**
 * Prospects data access: companies, contacts and leads (Unit 2.2,
 * 2026-09-23), and the automatic rescoring behind the Prospect Score (Unit
 * 2.3). Server only.
 *
 * Every create and change logs one activity row. Every change that can move
 * the score (the company, a contact, a lead or a signal) rescores the company
 * through `rescoreCompany`. An override keeps its score and band until it is
 * cleared, while the computed score keeps updating underneath it.
 *
 * Reads use `select('*')` so the columns migration 088 adds are simply absent
 * before it runs; writes drop them and retry (tolerant.ts).
 */

import { isMissingSchema } from '@/lib/tools/db';

import { logActivity, type TimelineRow, companyTimeline } from './activity';
import type { WriteResult } from './api';
import { growthDb } from './db';
import { getEngineSettings } from './engineSettings';
import { getApprovedKnowledge, type Actor } from './kb';
import {
  DEFAULT_COMPANY_COUNTRY,
  normaliseDomain,
  normaliseEmail,
  type GrowthContact,
  type GrowthLead,
  type GrowthSignal,
  type LeadSource,
} from './model';
import type { ProspectCompany, ProspectFilters } from './prospectsModel';
import { bandFor, scoreProspect, type ScoreResult } from './scoring/prospect';
import { insertTolerant, updateTolerant, isMissingColumn } from './tolerant';

export const COMPANY_088_COLUMNS = ['source', 'scale_sar', 'computed_score', 'prospect_score', 'prospect_band', 'score_reasons', 'score_override', 'override_reason', 'scored_at', 'import_id'] as const;
const IMPORT_COLUMN = ['import_id'] as const;

type Opts = { isTest?: boolean; importId?: string | null; system?: boolean; /** Bulk imports rescore once per company at the end. */ skipRescore?: boolean };

const actorFields = (actor: Actor | null, system?: boolean) => ({ actorType: system || !actor ? ('system' as const) : ('admin' as const), actorId: actor?.id ?? null });

function dbError(error: { code?: string; message?: string }, what: string): { ok: false; status: number; error: string } {
  if (isMissingSchema(error)) return { ok: false, status: 503, error: `The ${what} table is missing. Apply 083_growth_core.sql.` };
  if (error.code === '23514') return { ok: false, status: 422, error: `The database refused a ${what} value` };
  if (error.code === '23503') return { ok: false, status: 422, error: 'A linked record no longer exists' };
  return { ok: false, status: 500, error: error.message ?? 'Save failed' };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type CompanyListRow = ProspectCompany & { contacts: number; leads: number; newSignals: number; latestSignal: string | null };

export async function listCompanies(f: ProspectFilters, limit = 500): Promise<{ rows: CompanyListRow[]; missingTable: boolean; error: string | null }> {
  try {
    let q = growthDb().from('growth_companies').select('*').order('updated_at', { ascending: false }).limit(limit);
    if (f.status) q = q.eq('status', f.status);
    else q = q.neq('status', 'archived');
    if (f.source) q = q.eq('source', f.source);
    if (f.q) q = q.ilike('name', `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    if (!f.includeTest) q = q.eq('is_test', false);
    const { data, error } = await q;
    if (error) return { rows: [], missingTable: isMissingSchema(error), error: isMissingSchema(error) ? null : error.message };
    let companies = (data ?? []) as ProspectCompany[];
    if (f.band === 'unscored') companies = companies.filter((c) => !c.prospect_band);
    else if (f.band) companies = companies.filter((c) => c.prospect_band === f.band);
    const ids = companies.map((c) => c.id);
    const counts = new Map<string, { contacts: number; leads: number; newSignals: number; latestSignal: string | null }>();
    for (const id of ids) counts.set(id, { contacts: 0, leads: 0, newSignals: 0, latestSignal: null });
    for (let k = 0; k < ids.length; k += 200) {
      const chunk = ids.slice(k, k + 200);
      const [c, l, s] = await Promise.all([
        growthDb().from('growth_contacts').select('company_id').in('company_id', chunk),
        growthDb().from('growth_leads').select('company_id').in('company_id', chunk),
        growthDb().from('growth_signals').select('company_id, status, signal_date').in('company_id', chunk),
      ]);
      for (const r of (c.data ?? []) as { company_id: string }[]) counts.get(r.company_id)!.contacts++;
      for (const r of (l.data ?? []) as { company_id: string }[]) counts.get(r.company_id)!.leads++;
      for (const r of (s.data ?? []) as { company_id: string; status: string; signal_date: string }[]) {
        const e = counts.get(r.company_id)!;
        if (r.status === 'new') e.newSignals++;
        if (r.status !== 'dismissed' && (!e.latestSignal || r.signal_date > e.latestSignal)) e.latestSignal = r.signal_date;
      }
    }
    const rows = companies.map((c) => ({ ...c, ...counts.get(c.id)! }));
    rows.sort((a, b) => (b.prospect_score ?? -1) - (a.prospect_score ?? -1) || a.name.localeCompare(b.name));
    return { rows, missingTable: false, error: null };
  } catch (err) {
    return { rows: [], missingTable: false, error: err instanceof Error ? err.message : 'load failed' };
  }
}

export async function getCompany(id: string): Promise<ProspectCompany | null> {
  const { data } = await growthDb().from('growth_companies').select('*').eq('id', id).maybeSingle();
  return (data as ProspectCompany | null) ?? null;
}

export type ResearchBriefRow = {
  id: string;
  created_at: string;
  is_test: boolean;
  company_id: string;
  is_mock: boolean;
  model: string;
  usage_id: string | null;
  content: Record<string, unknown>;
  accepted: string[];
  accepted_at: string | null;
  accepted_by_name: string | null;
  created_by_name: string | null;
};

export type CompanyBundle = {
  company: ProspectCompany;
  contacts: GrowthContact[];
  leads: GrowthLead[];
  signals: GrowthSignal[];
  briefs: ResearchBriefRow[];
  briefsAvailable: boolean;
  timeline: TimelineRow[];
};

export async function getCompanyBundle(id: string): Promise<CompanyBundle | null> {
  const company = await getCompany(id);
  if (!company) return null;
  const db = growthDb();
  const [contacts, leads, signals, briefs] = await Promise.all([
    db.from('growth_contacts').select('*').eq('company_id', id).order('created_at'),
    db.from('growth_leads').select('*').eq('company_id', id).order('created_at'),
    db.from('growth_signals').select('*').eq('company_id', id).order('signal_date', { ascending: false }),
    db.from('growth_research_briefs').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(50),
  ]);
  const c = (contacts.data ?? []) as GrowthContact[];
  const l = (leads.data ?? []) as GrowthLead[];
  const s = (signals.data ?? []) as GrowthSignal[];
  const timeline = await companyTimeline(id, { contactIds: c.map((x) => x.id), leadIds: l.map((x) => x.id), signalIds: s.map((x) => x.id) });
  return {
    company,
    contacts: c,
    leads: l,
    signals: s,
    briefs: (briefs.data ?? []) as ResearchBriefRow[],
    briefsAvailable: !briefs.error,
    timeline,
  };
}

/** Companies to choose from in a picker: id and name, newest first. */
export async function companyOptions(includeTest = false): Promise<{ id: string; name: string }[]> {
  let q = growthDb().from('growth_companies').select('id, name').neq('status', 'archived').order('name').limit(1000);
  if (!includeTest) q = q.eq('is_test', false);
  const { data } = await q;
  return (data ?? []) as { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export type CompanyInput = {
  name: string;
  website_domain?: string | null;
  sector?: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  linkedin_url?: string | null;
  likely_service?: string | null;
  status?: string;
  notes?: string | null;
  source?: LeadSource | null;
  scale_sar?: number | null;
};

/** A company with the same website domain, or null. */
export async function companyByDomain(domain: string | null): Promise<ProspectCompany | null> {
  if (!domain) return null;
  const { data } = await growthDb().from('growth_companies').select('*').eq('website_domain', domain).maybeSingle();
  return (data as ProspectCompany | null) ?? null;
}

export async function createCompany(input: CompanyInput, actor: Actor | null, opts: Opts = {}): Promise<WriteResult<ProspectCompany>> {
  const domain = normaliseDomain(input.website_domain);
  const existing = await companyByDomain(domain);
  if (existing) return { ok: false, status: 409, code: 'duplicate', error: `${existing.name} already uses ${domain}` };
  const row: Record<string, unknown> = {
    ...input,
    name: input.name.trim(),
    website_domain: domain,
    country: input.country?.trim() || DEFAULT_COMPANY_COUNTRY,
    is_test: Boolean(opts.isTest),
  };
  if (opts.importId) row.import_id = opts.importId;
  const { data, error } = await insertTolerant<ProspectCompany>('growth_companies', row, COMPANY_088_COLUMNS);
  if (error || !data) {
    if (error?.code === '23505') return { ok: false, status: 409, code: 'duplicate', error: `Another company already uses ${domain}` };
    return dbError(error ?? {}, 'company');
  }
  await logActivity({ ...actorFields(actor, opts.system), action: 'company.created', summary: `Company ${data.name} added`, companyId: data.id, isTest: data.is_test, metadata: { source: input.source ?? null, import_id: opts.importId ?? null } });
  if (!opts.skipRescore) await rescoreCompany(data.id, { actor });
  return { ok: true, value: opts.skipRescore ? data : (await getCompany(data.id)) ?? data };
}

export async function updateCompany(id: string, patch: Partial<CompanyInput>, actor: Actor): Promise<WriteResult<ProspectCompany>> {
  const before = await getCompany(id);
  if (!before) return { ok: false, status: 404, error: 'Company not found' };
  const next: Record<string, unknown> = { ...patch };
  if ('website_domain' in patch) {
    next.website_domain = normaliseDomain(patch.website_domain);
    const clash = await companyByDomain(next.website_domain as string | null);
    if (clash && clash.id !== id) return { ok: false, status: 409, code: 'duplicate', error: `${clash.name} already uses ${next.website_domain}` };
  }
  if ('name' in patch && patch.name) next.name = patch.name.trim();
  const { data, error, dropped } = await updateTolerant<ProspectCompany>('growth_companies', id, next, COMPANY_088_COLUMNS);
  if (error || !data) return dbError(error ?? {}, 'company');
  const changed = Object.keys(next).filter((k) => !dropped.includes(k) && JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((next as Record<string, unknown>)[k] ?? null));
  if (changed.length) {
    await logActivity({ ...actorFields(actor), action: 'company.updated', summary: `Changed ${changed.join(', ')}`, companyId: id, isTest: data.is_test, metadata: { changes: Object.fromEntries(changed.map((k) => [k, { old: (before as Record<string, unknown>)[k] ?? null, new: next[k] ?? null }])) } });
    await rescoreCompany(id, { actor });
  }
  return { ok: true, value: (await getCompany(id)) ?? data };
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export type ContactInput = {
  full_name: string;
  role_title?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  is_decision_maker?: boolean;
  consent_status?: string;
  consent_source?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
};

export async function contactByEmail(email: string | null): Promise<GrowthContact | null> {
  if (!email) return null;
  const { data } = await growthDb().from('growth_contacts').select('*').eq('email', email).maybeSingle();
  return (data as GrowthContact | null) ?? null;
}

export async function createContact(companyId: string | null, input: ContactInput, actor: Actor | null, opts: Opts = {}): Promise<WriteResult<GrowthContact>> {
  const email = normaliseEmail(input.email);
  const existing = await contactByEmail(email);
  if (existing) return { ok: false, status: 409, code: 'duplicate', error: `${existing.full_name} already uses ${email}` };
  const row: Record<string, unknown> = { ...input, email, full_name: input.full_name.trim(), company_id: companyId, is_test: Boolean(opts.isTest) };
  if (input.consent_status && input.consent_status !== 'unknown') row.consent_at = new Date().toISOString();
  if (opts.importId) row.import_id = opts.importId;
  const { data, error } = await insertTolerant<GrowthContact>('growth_contacts', row, IMPORT_COLUMN);
  if (error || !data) {
    if (error?.code === '23505') return { ok: false, status: 409, code: 'duplicate', error: `Another contact already uses ${email}` };
    return dbError(error ?? {}, 'contact');
  }
  await logActivity({ ...actorFields(actor, opts.system), action: 'contact.created', summary: `Contact ${data.full_name}${data.role_title ? `, ${data.role_title}` : ''} added`, companyId, contactId: data.id, isTest: data.is_test });
  if (companyId && !opts.skipRescore) await rescoreCompany(companyId, { actor });
  return { ok: true, value: data };
}

export async function updateContact(id: string, patch: Partial<ContactInput>, actor: Actor): Promise<WriteResult<GrowthContact>> {
  const { data: beforeRow } = await growthDb().from('growth_contacts').select('*').eq('id', id).maybeSingle();
  const before = beforeRow as GrowthContact | null;
  if (!before) return { ok: false, status: 404, error: 'Contact not found' };
  const next: Record<string, unknown> = { ...patch };
  if ('email' in patch) {
    next.email = normaliseEmail(patch.email);
    const clash = await contactByEmail(next.email as string | null);
    if (clash && clash.id !== id) return { ok: false, status: 409, code: 'duplicate', error: `${clash.full_name} already uses ${next.email}` };
  }
  if ('consent_status' in patch && patch.consent_status !== before.consent_status) next.consent_at = new Date().toISOString();
  const { data, error } = await growthDb().from('growth_contacts').update(next).eq('id', id).select('*').single();
  if (error || !data) return dbError(error ?? {}, 'contact');
  const after = data as GrowthContact;
  const changed = Object.keys(patch).filter((k) => JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify(next[k] ?? null));
  if (changed.length) {
    await logActivity({ ...actorFields(actor), action: 'contact.updated', summary: `${after.full_name}: changed ${changed.join(', ')}`, companyId: after.company_id, contactId: id, isTest: after.is_test, metadata: { changes: Object.fromEntries(changed.map((k) => [k, { old: (before as Record<string, unknown>)[k] ?? null, new: next[k] ?? null }])) } });
    if (after.company_id) await rescoreCompany(after.company_id, { actor });
  }
  return { ok: true, value: after };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export type LeadInput = {
  title: string;
  contact_id?: string | null;
  stage?: string;
  recommended_service?: string | null;
  requirement?: string | null;
  deal_size_sar?: number | null;
  timeline?: string | null;
  source?: LeadSource;
  source_ref?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  lost_reason?: string | null;
};

export async function getLead(id: string): Promise<GrowthLead | null> {
  const { data } = await growthDb().from('growth_leads').select('*').eq('id', id).maybeSingle();
  return (data as GrowthLead | null) ?? null;
}

export async function createLead(companyId: string | null, input: LeadInput, actor: Actor | null, opts: Opts = {}): Promise<WriteResult<GrowthLead>> {
  const row: Record<string, unknown> = { ...input, title: input.title.trim(), company_id: companyId, source: input.source ?? 'outbound', is_test: Boolean(opts.isTest) };
  if (opts.importId) row.import_id = opts.importId;
  const { data, error } = await insertTolerant<GrowthLead>('growth_leads', row, IMPORT_COLUMN);
  if (error || !data) return dbError(error ?? {}, 'lead');
  await logActivity({ ...actorFields(actor, opts.system), action: 'lead.created', summary: `Lead "${data.title}" opened (${data.source})`, companyId, contactId: data.contact_id, leadId: data.id, isTest: data.is_test });
  if (companyId && !opts.skipRescore) await rescoreCompany(companyId, { actor });
  return { ok: true, value: data };
}

export async function updateLead(id: string, patch: Partial<LeadInput>, actor: Actor | null, opts: { system?: boolean; actorType?: 'admin' | 'system' | 'ai' } = {}): Promise<WriteResult<GrowthLead>> {
  const before = await getLead(id);
  if (!before) return { ok: false, status: 404, error: 'Lead not found' };
  const next: Record<string, unknown> = { ...patch };
  const stageChanged = patch.stage && patch.stage !== before.stage;
  if (stageChanged) next.stage_changed_at = new Date().toISOString();
  const { data, error } = await growthDb().from('growth_leads').update(next).eq('id', id).select('*').single();
  if (error || !data) return dbError(error ?? {}, 'lead');
  const after = data as GrowthLead;
  const who = { actorType: opts.actorType ?? (opts.system || !actor ? ('system' as const) : ('admin' as const)), actorId: actor?.id ?? null };
  if (stageChanged) {
    await logActivity({ ...who, action: 'lead.stage_changed', summary: `"${after.title}" moved from ${before.stage} to ${after.stage}`, companyId: after.company_id, contactId: after.contact_id, leadId: id, isTest: after.is_test, metadata: { from: before.stage, to: after.stage } });
  }
  const changed = Object.keys(patch).filter((k) => k !== 'stage' && JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify(next[k] ?? null));
  if (changed.length) {
    await logActivity({ ...who, action: 'lead.updated', summary: `"${after.title}": changed ${changed.join(', ')}`, companyId: after.company_id, leadId: id, isTest: after.is_test, metadata: { changes: Object.fromEntries(changed.map((k) => [k, { old: (before as Record<string, unknown>)[k] ?? null, new: next[k] ?? null }])) } });
  }
  if (after.company_id && (changed.includes('deal_size_sar') || stageChanged)) await rescoreCompany(after.company_id, { actor });
  return { ok: true, value: after };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Targeting rules from the approved Knowledge Base: decision-maker titles and excluded work. */
export async function targetingRules(includeTest = false): Promise<{ decisionMakerTitles: string[]; excludedWork: string[] }> {
  const kb = await getApprovedKnowledge({ includeTest }).catch(() => null);
  const out = { decisionMakerTitles: [] as string[], excludedWork: [] as string[] };
  for (const item of kb?.targeting ?? []) {
    const c = item.content as Record<string, string | string[]>;
    if (Array.isArray(c.decision_maker_titles)) out.decisionMakerTitles.push(...c.decision_maker_titles);
    if (Array.isArray(c.excluded_work)) out.excludedWork.push(...c.excluded_work);
  }
  return out;
}

/** The score as the rules compute it today, without saving anything. */
export async function computeCompanyScore(companyId: string): Promise<ScoreResult | null> {
  const db = growthDb();
  const company = await getCompany(companyId);
  if (!company) return null;
  const [contacts, leads, signals, engine, targeting] = await Promise.all([
    db.from('growth_contacts').select('is_decision_maker, role_title').eq('company_id', companyId),
    db.from('growth_leads').select('deal_size_sar').eq('company_id', companyId),
    db.from('growth_signals').select('trigger_type, signal_date, status').eq('company_id', companyId),
    getEngineSettings(),
    targetingRules(company.is_test),
  ]);
  return scoreProspect({
    company,
    contacts: (contacts.data ?? []) as { is_decision_maker: boolean; role_title: string | null }[],
    leads: (leads.data ?? []) as { deal_size_sar: number | string | null }[],
    signals: (signals.data ?? []) as GrowthSignal[],
    weights: engine.values.scoring_weights,
    targeting,
  });
}

/**
 * Recomputes and stores a company's score. With an override in place, only the
 * computed score changes. Logs a row when the effective score or band moves.
 * Before migration 088 the score columns do not exist: nothing is stored.
 */
export async function rescoreCompany(companyId: string, opts: { actor?: Actor | null } = {}): Promise<ScoreResult | null> {
  const result = await computeCompanyScore(companyId);
  if (!result) return null;
  const company = await getCompany(companyId);
  if (!company || !('computed_score' in company)) return result;
  const patch: Record<string, unknown> = { computed_score: result.score, scored_at: new Date().toISOString() };
  if (!company.score_override) {
    patch.prospect_score = result.score;
    patch.prospect_band = result.band;
    patch.score_reasons = result.reasons;
  }
  const { error } = await growthDb().from('growth_companies').update(patch).eq('id', companyId);
  if (error) {
    if (!isMissingColumn(error)) console.error('[growth-score] not stored:', error.message);
    return result;
  }
  if (!company.score_override) {
    await growthDb().from('growth_leads').update({ prospect_score: result.score, prospect_band: result.band }).eq('company_id', companyId).eq('score_override', false);
    if (company.prospect_score !== result.score || company.prospect_band !== result.band) {
      await logActivity({
        actorType: 'system',
        actorId: 'prospect-score',
        action: 'company.scored',
        summary: `Prospect Score ${company.prospect_score ?? 'none'} to ${result.score} (${result.band})`,
        companyId,
        isTest: company.is_test,
        metadata: { score: result.score, band: result.band, reasons: result.reasons, factors: result.factors, by: opts.actor?.name ?? null },
      });
    }
  }
  return result;
}

/** Sets or clears a manual score. Setting needs a reason; the band follows the score, and the SAR 50 million rule still applies. */
export async function setScoreOverride(companyId: string, input: { action: 'set'; score: number; reason: string } | { action: 'clear' }, actor: Actor): Promise<WriteResult<ProspectCompany>> {
  const company = await getCompany(companyId);
  if (!company) return { ok: false, status: 404, error: 'Company not found' };
  if (!('score_override' in company)) return { ok: false, status: 503, error: 'Score overrides need 088_growth_prospecting.sql applied first.' };
  const computed = await computeCompanyScore(companyId);
  let patch: Record<string, unknown>;
  if (input.action === 'set') {
    const band = computed?.belowMinimum ? 'low' : bandFor(input.score);
    patch = { score_override: true, override_reason: input.reason, prospect_score: input.score, prospect_band: band, score_reasons: [`Set by hand to ${input.score}: ${input.reason}`, ...(computed ? [`The rules give ${computed.score} (${computed.band}).`] : [])] };
  } else {
    patch = { score_override: false, override_reason: null };
  }
  const { error } = await growthDb().from('growth_companies').update(patch).eq('id', companyId);
  if (error) return dbError(error, 'company');
  await logActivity({
    actorType: 'admin',
    actorId: actor.id,
    action: input.action === 'set' ? 'company.score_override' : 'company.score_override_cleared',
    summary: input.action === 'set' ? `Score set by hand to ${input.score}: ${input.reason}` : 'Manual score cleared; the rules score applies again',
    companyId,
    isTest: company.is_test,
    metadata: input.action === 'set' ? { score: input.score, reason: input.reason, computed: computed?.score ?? null } : {},
  });
  if (input.action === 'clear') await rescoreCompany(companyId, { actor });
  else await growthDb().from('growth_leads').update({ prospect_score: patch.prospect_score, prospect_band: patch.prospect_band }).eq('company_id', companyId);
  return { ok: true, value: (await getCompany(companyId)) ?? company };
}
