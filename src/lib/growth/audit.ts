/**
 * The Growth audit log view (Unit 1.4, 2026-09-22): growth_activity, newest
 * first in a reliable order (created_at then seq), filtered and paginated.
 * Server only, read only.
 */

import { growthDb } from './db';

export const AUDIT_PAGE_SIZE = 50;

/** Activity types by action prefix. */
export const AUDIT_TYPES = [
  { value: 'settings', label: 'Settings' },
  { value: 'suppression', label: 'Suppression' },
  { value: 'kb', label: 'Knowledge Base' },
  { value: 'lead', label: 'Leads' },
  { value: 'signal', label: 'Signals' },
  { value: 'contact', label: 'Contacts' },
  { value: 'company', label: 'Companies' },
] as const;

export const AUDIT_ACTORS = [
  { value: 'admin', label: 'Ahmad (admin)' },
  { value: 'ai', label: 'AI agent' },
  { value: 'system', label: 'System' },
] as const;

export type AuditFilters = {
  type: string;
  actor: string;
  from: string;
  to: string;
  /** `company:<id>`, `lead:<id>` or `kb:<id>`. */
  related: string;
  includeTest: boolean;
  page: number;
};

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RELATED = /^(company|lead|kb):[0-9a-f-]{36}$/i;

export function parseAuditFilters(search: Record<string, string | string[] | undefined>): AuditFilters {
  const type = one(search.type);
  const actor = one(search.actor);
  const page = Number(one(search.page));
  return {
    type: AUDIT_TYPES.some((t) => t.value === type) ? type : '',
    actor: AUDIT_ACTORS.some((a) => a.value === actor) ? actor : '',
    from: DATE.test(one(search.from)) ? one(search.from) : '',
    to: DATE.test(one(search.to)) ? one(search.to) : '',
    related: RELATED.test(one(search.related)) ? one(search.related) : '',
    includeTest: one(search.test) === '1',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export type AuditRow = {
  id: string;
  created_at: string;
  seq: number;
  is_test: boolean;
  actor_type: string;
  actor_id: string | null;
  action: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  company_id: string | null;
  lead_id: string | null;
  kb_item_id: string | null;
};

export async function listAudit(f: AuditFilters): Promise<{ rows: AuditRow[]; total: number; error: string | null }> {
  const filtered = (cols: string) => {
    let q = growthDb().from('growth_activity').select(cols, { count: 'exact' });
    if (f.type) q = q.like('action', `${f.type}.%`);
    if (f.actor) q = q.eq('actor_type', f.actor);
    if (f.from) q = q.gte('created_at', `${f.from}T00:00:00Z`);
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59.999Z`);
    if (f.related) {
      const [kind, id] = f.related.split(':');
      q = q.eq(kind === 'company' ? 'company_id' : kind === 'lead' ? 'lead_id' : 'kb_item_id', id);
    }
    if (!f.includeTest) q = q.eq('is_test', false);
    return q;
  };
  try {
    const start = (f.page - 1) * AUDIT_PAGE_SIZE;
    const { data, error, count } = await filtered('id, created_at, seq, is_test, actor_type, actor_id, action, summary, metadata, company_id, lead_id, kb_item_id')
      .order('created_at', { ascending: false })
      .order('seq', { ascending: false })
      .range(start, start + AUDIT_PAGE_SIZE - 1);
    if (error?.code === 'PGRST103') {
      // A page past the end: PostgREST refuses the range. Show no rows and the real total.
      const { count: total } = await filtered('id').limit(1);
      return { rows: [], total: total ?? 0, error: null };
    }
    if (error) return { rows: [], total: 0, error: error.message };
    return { rows: (data ?? []) as unknown as AuditRow[], total: count ?? 0, error: null };
  } catch (err) {
    return { rows: [], total: 0, error: err instanceof Error ? err.message : 'load failed' };
  }
}

export type RelatedOption = { value: string; label: string };

/** Companies, leads and Knowledge Base items to filter by. */
export async function relatedOptions(includeTest: boolean): Promise<{ companies: RelatedOption[]; leads: RelatedOption[]; kb: RelatedOption[] }> {
  const q = (table: string, cols: string, order: string) => {
    let x = growthDb().from(table).select(cols).order(order).limit(300);
    if (!includeTest) x = x.eq('is_test', false);
    return x;
  };
  const [c, l, k] = await Promise.all([q('growth_companies', 'id, name', 'name'), q('growth_leads', 'id, title', 'title'), q('growth_kb_items', 'id, title, kind', 'title')]);
  return {
    companies: ((c.data ?? []) as unknown as { id: string; name: string }[]).map((r) => ({ value: `company:${r.id}`, label: r.name })),
    leads: ((l.data ?? []) as unknown as { id: string; title: string }[]).map((r) => ({ value: `lead:${r.id}`, label: r.title })),
    kb: ((k.data ?? []) as unknown as { id: string; title: string; kind: string }[]).map((r) => ({ value: `kb:${r.id}`, label: `${r.title} (${r.kind.replace('_', ' ')})` })),
  };
}
