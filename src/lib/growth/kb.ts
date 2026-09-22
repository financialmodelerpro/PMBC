/**
 * Knowledge Base data access (Unit 1.3, 2026-09-22). Server only.
 *
 * `getApprovedKnowledge` is the one way an agent reads the Knowledge Base: the
 * approved copy of approved items, grouped by kind. It never returns a draft,
 * an archived item, or the working copy of an item being edited, and it
 * excludes test rows unless asked for them.
 *
 * Writes set `updated_by` and `updated_by_name`; the table's trigger logs
 * creation, approval, edits to approved items, archiving and restoring to
 * growth_activity in the same statement (migration 084).
 */

import { isMissingSchema } from '@/lib/tools/db';

import { growthDb } from './db';
import {
  KB_KINDS,
  approvalProblems,
  approvedSnapshot,
  cleanKbContent,
  cleanRelatedServices,
  SITE_SERVICE_OPTIONS,
  kbKind,
  validSiteServiceSlug,
  type KbContent,
  type KbKind,
  type KbSnapshot,
  type KbStatus,
} from './kbModel';

export type KbItem = {
  id: string;
  created_at: string;
  updated_at: string;
  is_test: boolean;
  kind: KbKind;
  item_key: string | null;
  sort_order: number;
  title: string;
  content: KbContent;
  site_service_slug: string | null;
  case_study_id: string | null;
  related_service_slugs: string[];
  status: KbStatus;
  approved_title: string | null;
  approved_content: KbSnapshot | null;
  approved_at: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
};

export type Actor = { id: string; name: string };

/** Without related_service_slugs, for a database where migration 086 has not run. */
const COLUMNS_BEFORE_086 =
  'id, created_at, updated_at, is_test, kind, item_key, sort_order, title, content, site_service_slug, case_study_id, status, approved_title, approved_content, approved_at, approved_by, approved_by_name, updated_by, updated_by_name';

const missingRelated = (error: { message?: string } | null) => Boolean(error && /related_service_slugs/.test(error.message ?? ''));
const withRelated = (rows: unknown[]) => (rows as KbItem[]).map((r) => ({ ...r, related_service_slugs: r.related_service_slugs ?? [] }));

const COLUMNS =
  'id, created_at, updated_at, is_test, kind, item_key, sort_order, title, content, site_service_slug, case_study_id, related_service_slugs, status, approved_title, approved_content, approved_at, approved_by, approved_by_name, updated_by, updated_by_name';

/** True when an approved item's working copy differs from what was approved. */
export function hasUnapprovedEdits(item: KbItem): boolean {
  if (!item.approved_content || item.approved_title === null) return false;
  const snap = approvedSnapshot({ kind: item.kind, title: item.title, content: item.content, site_service_slug: item.site_service_slug, case_study_id: item.case_study_id, related_service_slugs: item.related_service_slugs });
  return item.title !== item.approved_title || JSON.stringify(snap) !== JSON.stringify(item.approved_content);
}

export type KbList = { items: KbItem[]; missingTable: boolean; error: string | null };

export async function listKbItems(filters: { kind?: KbKind | null; status?: KbStatus | null; includeTest?: boolean } = {}): Promise<KbList> {
  try {
    const run = (cols: string) => {
      let q = growthDb().from('growth_kb_items').select(cols).order('kind').order('sort_order').order('created_at');
      if (filters.kind) q = q.eq('kind', filters.kind);
      if (filters.status) q = q.eq('status', filters.status);
      if (!filters.includeTest) q = q.eq('is_test', false);
      return q;
    };
    let { data, error } = await run(COLUMNS);
    if (missingRelated(error)) ({ data, error } = await run(COLUMNS_BEFORE_086));
    if (error) return { items: [], missingTable: isMissingSchema(error), error: isMissingSchema(error) ? null : error.message };
    return { items: withRelated(data ?? []), missingTable: false, error: null };
  } catch (err) {
    return { items: [], missingTable: false, error: err instanceof Error ? err.message : 'load failed' };
  }
}

export async function getKbItem(id: string): Promise<KbItem | null> {
  let { data, error } = await growthDb().from('growth_kb_items').select(COLUMNS).eq('id', id).maybeSingle();
  if (missingRelated(error)) ({ data, error } = await growthDb().from('growth_kb_items').select(COLUMNS_BEFORE_086).eq('id', id).maybeSingle());
  return data ? withRelated([data])[0] : null;
}

export type KbActivity = { id: string; created_at: string; action: string; summary: string | null; actor_type: string; actor_id: string | null; metadata: Record<string, unknown> };

/** The item's history, newest first, in insertion order within the same instant. */
export async function kbItemActivity(id: string): Promise<KbActivity[]> {
  const { data } = await growthDb()
    .from('growth_activity')
    .select('id, created_at, action, summary, actor_type, actor_id, metadata')
    .eq('kb_item_id', id)
    .order('created_at', { ascending: false })
    .order('seq', { ascending: false })
    .limit(100);
  return (data ?? []) as KbActivity[];
}

export type CaseStudyOption = { id: string; title: string; slug: string; status: string };

/** Existing case study records a Knowledge Base item can link to. Read only. */
export async function listCaseStudyOptions(): Promise<CaseStudyOption[]> {
  try {
    const { data } = await growthDb().from('case_studies').select('id, title, slug, status').order('display_order').order('title');
    return (data ?? []) as CaseStudyOption[];
  } catch {
    return [];
  }
}

export type KbWriteResult = { ok: true; item: KbItem } | { ok: false; status: number; error: string };

/**
 * The links an item may carry, by kind. A service always links to its own
 * site page, fixed by its key; an offer links to any of the nine services; a
 * case study to its record. Anything else is dropped.
 */
function links(
  kind: KbKind,
  input: { case_study_id?: string | null; related_service_slugs?: string[] | null },
  itemKey: string | null,
): { site_service_slug: string | null; case_study_id: string | null; related_service_slugs: string[] } | string {
  const cfg = kbKind(kind);
  const related = input.related_service_slugs ?? [];
  if (cfg.link === 'related_services' && related.some((slug) => !validSiteServiceSlug(slug))) return 'Unknown site service';
  return {
    site_service_slug: cfg.link === 'site_page' ? itemKey : null,
    case_study_id: cfg.link === 'case_study' ? input.case_study_id ?? null : null,
    related_service_slugs: cfg.link === 'related_services' ? cleanRelatedServices(related) : [],
  };
}

function writeError(error: { code?: string; message?: string }): KbWriteResult {
  if (isMissingSchema(error)) return { ok: false, status: 503, error: 'The Knowledge Base table is missing. Apply 084_growth_knowledge_base.sql.' };
  if (error.code === '23503') return { ok: false, status: 422, error: 'That case study record no longer exists' };
  return { ok: false, status: 500, error: error.message ?? 'Save failed' };
}

export async function createKbItem(
  input: { kind: KbKind; title: string; content: unknown; site_service_slug?: string | null; case_study_id?: string | null; related_service_slugs?: string[] | null },
  actor: Actor,
  opts: { isTest?: boolean } = {},
): Promise<KbWriteResult> {
  if (kbKind(input.kind).fixed) return { ok: false, status: 422, error: `${kbKind(input.kind).label} are fixed: edit the existing items` };
  const l = links(input.kind, input, null);
  if (typeof l === 'string') return { ok: false, status: 422, error: l };
  const row = { kind: input.kind, title: input.title.trim(), content: cleanKbContent(input.kind, input.content), ...l, is_test: Boolean(opts.isTest), updated_by: actor.id, updated_by_name: actor.name };
  let { data, error } = await growthDb().from('growth_kb_items').insert(row).select(COLUMNS).single();
  if (missingRelated(error)) {
    const { related_service_slugs: _unused, ...before086 } = row;
    ({ data, error } = await growthDb().from('growth_kb_items').insert(before086).select(COLUMNS_BEFORE_086).single());
  }
  if (error) return writeError(error);
  return { ok: true, item: withRelated([data])[0] };
}

/** Edits the working copy only. An approved item stays approved, on its approved copy. */
export async function editKbItem(
  id: string,
  input: { title: string; content: unknown; site_service_slug?: string | null; case_study_id?: string | null; related_service_slugs?: string[] | null },
  actor: Actor,
): Promise<KbWriteResult> {
  const current = await getKbItem(id);
  if (!current) return { ok: false, status: 404, error: 'Item not found' };
  if (current.status === 'archived') return { ok: false, status: 409, error: 'Restore the item before editing it' };
  const l = links(current.kind, input, current.item_key);
  if (typeof l === 'string') return { ok: false, status: 422, error: l };
  const patch = { title: input.title.trim(), content: cleanKbContent(current.kind, input.content), ...l, updated_by: actor.id, updated_by_name: actor.name };
  let { data, error } = await growthDb().from('growth_kb_items').update(patch).eq('id', id).select(COLUMNS).single();
  if (missingRelated(error)) {
    const { related_service_slugs: _unused, ...before086 } = patch;
    ({ data, error } = await growthDb().from('growth_kb_items').update(before086).eq('id', id).select(COLUMNS_BEFORE_086).single());
  }
  if (error) return writeError(error);
  return { ok: true, item: withRelated([data])[0] };
}

/**
 * Approve copies the working copy to the approved copy and records who and
 * when. Archive removes the item from agents. Restore returns an archived item
 * to draft, so it needs approving again before an agent sees it.
 */
export async function actOnKbItem(id: string, action: 'approve' | 'archive' | 'restore', actor: Actor): Promise<KbWriteResult> {
  const current = await getKbItem(id);
  if (!current) return { ok: false, status: 404, error: 'Item not found' };
  let patch: Record<string, unknown>;
  if (action === 'approve') {
    if (current.status === 'archived') return { ok: false, status: 409, error: 'Restore the item before approving it' };
    const draft = { kind: current.kind, title: current.title, content: current.content, site_service_slug: current.site_service_slug, case_study_id: current.case_study_id, related_service_slugs: current.related_service_slugs };
    const problems = approvalProblems(draft);
    if (problems.length) return { ok: false, status: 422, error: `Not ready to approve: ${problems.join('; ')}` };
    patch = {
      status: 'approved',
      approved_title: current.title,
      approved_content: approvedSnapshot(draft),
      approved_at: new Date().toISOString(),
      approved_by: actor.id,
      approved_by_name: actor.name,
    };
  } else if (action === 'archive') {
    if (current.status === 'archived') return { ok: true, item: current };
    patch = { status: 'archived' };
  } else {
    if (current.status !== 'archived') return { ok: true, item: current };
    patch = { status: 'draft' };
  }
  const write = (cols: string) => growthDb().from('growth_kb_items').update({ ...patch, updated_by: actor.id, updated_by_name: actor.name }).eq('id', id).select(cols).single();
  // PostgREST refuses an unknown column before running the update, so the retry cannot write twice.
  let { data, error } = await write(COLUMNS);
  if (missingRelated(error)) ({ data, error } = await write(COLUMNS_BEFORE_086));
  if (error) return writeError(error);
  return { ok: true, item: withRelated([data])[0] };
}

export type ApprovedKbItem = {
  id: string;
  kind: KbKind;
  key: string | null;
  title: string;
  content: KbContent;
  approvedAt: string;
  approvedBy: string | null;
  /** A service's own site page. */
  siteService?: { slug: string; title: string; href: string } | null;
  /** An offer's related services, with their site pages. */
  relatedServices?: { slug: string; title: string; href: string }[];
  caseStudy?: CaseStudyOption | null;
};

export type ApprovedKnowledge = Record<KbKind, ApprovedKbItem[]> & { generatedAt: string; ready: boolean };

/**
 * All approved knowledge, grouped by kind, for AI agents. Approved copy only.
 * `ready` is false when the table is missing or unreadable, so an agent can
 * refuse to run without its rules rather than run with none.
 */
export async function getApprovedKnowledge(opts: { includeTest?: boolean } = {}): Promise<ApprovedKnowledge> {
  const empty = Object.fromEntries(KB_KINDS.map((k) => [k.kind, []])) as unknown as Record<KbKind, ApprovedKbItem[]>;
  const out: ApprovedKnowledge = { ...empty, generatedAt: new Date().toISOString(), ready: false };
  let q = growthDb()
    .from('growth_kb_items')
    .select('id, kind, item_key, sort_order, status, approved_title, approved_content, approved_at, approved_by_name, is_test')
    .eq('status', 'approved')
    .not('approved_content', 'is', null)
    .order('sort_order')
    .order('approved_at');
  if (!opts.includeTest) q = q.eq('is_test', false);
  const { data, error } = await q;
  if (error) return out;
  const rows = (data ?? []) as Pick<KbItem, 'id' | 'kind' | 'item_key' | 'approved_title' | 'approved_content' | 'approved_at' | 'approved_by_name'>[];

  const caseIds = [...new Set(rows.map((r) => r.approved_content?.case_study_id).filter((x): x is string => typeof x === 'string' && x.length > 0))];
  const cases = new Map<string, CaseStudyOption>();
  if (caseIds.length) {
    const { data: cs } = await growthDb().from('case_studies').select('id, title, slug, status').in('id', caseIds);
    for (const c of (cs ?? []) as CaseStudyOption[]) cases.set(c.id, c);
  }

  for (const r of rows) {
    if (!r.approved_content || !r.approved_title || !r.approved_at) continue;
    const { site_service_slug, case_study_id, related_service_slugs, ...content } = r.approved_content;
    const slug = typeof site_service_slug === 'string' ? site_service_slug : null;
    const caseId = typeof case_study_id === 'string' ? case_study_id : null;
    const item: ApprovedKbItem = { id: r.id, kind: r.kind, key: r.item_key, title: r.approved_title, content: content as KbContent, approvedAt: r.approved_at, approvedBy: r.approved_by_name };
    const page = (s: string) => {
      const svc = SITE_SERVICE_OPTIONS.find((o) => o.slug === s);
      return svc ? { slug: svc.slug, title: svc.title, href: `/services/${svc.slug}` } : null;
    };
    if (kbKind(r.kind).link === 'site_page') item.siteService = slug ? page(slug) : null;
    if (kbKind(r.kind).link === 'related_services') item.relatedServices = (Array.isArray(related_service_slugs) ? related_service_slugs : []).map(page).filter((x): x is NonNullable<typeof x> => x !== null);
    if (kbKind(r.kind).link === 'case_study') item.caseStudy = caseId ? cases.get(caseId) ?? null : null;
    out[r.kind].push(item);
  }
  out.ready = true;
  return out;
}

export type KbReadiness = { kind: KbKind; label: string; approved: number; total: number };

/** "Services: 2 of 6 approved", per kind, counting items that are not archived. */
export function kbReadiness(items: KbItem[]): KbReadiness[] {
  return KB_KINDS.map((k) => {
    const live = items.filter((i) => i.kind === k.kind && i.status !== 'archived');
    return { kind: k.kind, label: k.label, approved: live.filter((i) => i.status === 'approved').length, total: live.length };
  });
}
