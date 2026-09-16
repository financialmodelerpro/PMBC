/**
 * Read models for the admin Tools and Tool leads screens.
 *
 * Every function reports `missingTable` instead of throwing, which is how the
 * screens show "migration not applied" rather than an error page.
 */

import { isMissingSchema, toolsDb, type EmailStatus, type ToolLeadRow } from './db';

export const TOOL_VISIBILITY_AUDIT = { entityType: 'tool', action: 'tool_visibility' } as const;

export type LeadCounts = { total: number; last30: number };

export async function leadCountsBySlug(slugs: string[]): Promise<{ counts: Record<string, LeadCounts>; missingTable: boolean }> {
  const counts: Record<string, LeadCounts> = {};
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  let missingTable = false;
  await Promise.all(
    slugs.map(async (slug) => {
      const base = () =>
        toolsDb().from('tool_leads').select('id', { count: 'exact', head: true }).eq('tool_slug', slug).eq('is_test', false);
      const [all, recent] = await Promise.all([base(), base().gte('created_at', since)]);
      if (isMissingSchema(all.error) || isMissingSchema(recent.error)) missingTable = true;
      counts[slug] = { total: all.count ?? 0, last30: recent.count ?? 0 };
    }),
  );
  return { counts, missingTable };
}

export type VisibilityHistoryEntry = {
  id: string;
  created_at: string;
  admin: string;
  from: string | null;
  to: string | null;
};

export async function visibilityHistory(slug: string): Promise<VisibilityHistoryEntry[]> {
  try {
    const { data } = await toolsDb()
      .from('audit_log')
      .select('id, created_at, before_value, after_value, metadata, admin_users(name, email)')
      .eq('entity_type', TOOL_VISIBILITY_AUDIT.entityType)
      .eq('entity_id', slug)
      .order('created_at', { ascending: false })
      .limit(100);
    type Row = {
      id: string;
      created_at: string;
      before_value: { status?: string } | null;
      after_value: { status?: string } | null;
      metadata: { from?: string; to?: string } | null;
      admin_users: { name: string | null; email: string } | { name: string | null; email: string }[] | null;
    };
    return ((data ?? []) as Row[]).map((r) => {
      const admin = Array.isArray(r.admin_users) ? r.admin_users[0] : r.admin_users;
      return {
        id: r.id,
        created_at: r.created_at,
        admin: admin?.name || admin?.email || 'Unknown',
        from: r.before_value?.status ?? r.metadata?.from ?? null,
        to: r.after_value?.status ?? r.metadata?.to ?? null,
      };
    });
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------------ */
/* Lead list                                                                 */
/* ------------------------------------------------------------------------ */

export type LeadFilters = {
  tool: string;
  from: string;
  to: string;
  deal: string;
  belowMin: '' | 'yes' | 'no';
  email: '' | EmailStatus;
  includeTest: boolean;
  page: number;
};

export const LEAD_PAGE_SIZE = 50;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export function parseLeadFilters(search: Record<string, string | string[] | undefined>): LeadFilters {
  const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const belowMin = one(search.below);
  return {
    tool: one(search.tool).slice(0, 80),
    from: date(one(search.from)),
    to: date(one(search.to)),
    deal: one(search.deal).slice(0, 20),
    belowMin: belowMin === 'yes' || belowMin === 'no' ? belowMin : '',
    email: one(search.email).slice(0, 20) as LeadFilters['email'],
    includeTest: one(search.test) === '1',
    page: Math.max(1, parseInt(one(search.page), 10) || 1),
  };
}

export type LeadListRow = Pick<
  ToolLeadRow,
  | 'id'
  | 'created_at'
  | 'tool_slug'
  | 'is_test'
  | 'name'
  | 'email'
  | 'company'
  | 'deal_size_band'
  | 'below_minimum'
  | 'country'
  | 'currency'
  | 'equity_mid'
  | 'status'
  | 'email_status'
  | 'booking_clicks'
>;

export async function listLeads(f: LeadFilters): Promise<{ rows: LeadListRow[]; total: number; missingTable: boolean; error: string | null }> {
  try {
    let q = toolsDb()
      .from('tool_leads')
      .select(
        'id, created_at, tool_slug, is_test, name, email, company, deal_size_band, below_minimum, country, currency, equity_mid, status, email_status, booking_clicks',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range((f.page - 1) * LEAD_PAGE_SIZE, f.page * LEAD_PAGE_SIZE - 1);
    if (f.tool) q = q.eq('tool_slug', f.tool);
    if (f.from) q = q.gte('created_at', `${f.from}T00:00:00Z`);
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59.999Z`);
    if (f.deal) q = q.eq('deal_size_band', f.deal);
    if (f.belowMin) q = q.eq('below_minimum', f.belowMin === 'yes');
    if (f.email) q = q.eq('email_status', f.email);
    if (!f.includeTest) q = q.eq('is_test', false);
    const { data, count, error } = await q;
    if (error) return { rows: [], total: 0, missingTable: isMissingSchema(error), error: isMissingSchema(error) ? null : error.message };
    return { rows: (data ?? []) as LeadListRow[], total: count ?? 0, missingTable: false, error: null };
  } catch (err) {
    return { rows: [], total: 0, missingTable: false, error: err instanceof Error ? err.message : 'load failed' };
  }
}

/** Plain-language email status, with opens marked as the weak signal they are. */
export function emailStatusLabel(status: string): { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' } {
  switch (status) {
    case 'clicked':
      return { label: 'Clicked', tone: 'success' };
    case 'opened':
      return { label: 'Opened (weak signal)', tone: 'neutral' };
    case 'delivered':
      return { label: 'Delivered', tone: 'success' };
    case 'sent':
      return { label: 'Sent', tone: 'neutral' };
    case 'deferred':
      return { label: 'Deferred', tone: 'warning' };
    case 'pending':
      return { label: 'Pending', tone: 'warning' };
    case 'not_configured':
      return { label: 'Email not configured', tone: 'warning' };
    case 'bounced':
      return { label: 'Bounced', tone: 'danger' };
    case 'blocked':
      return { label: 'Blocked', tone: 'danger' };
    case 'complaint':
      return { label: 'Spam complaint', tone: 'danger' };
    case 'failed':
      return { label: 'Failed', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export const EMAIL_STATUS_FILTERS: EmailStatus[] = [
  'pending', 'sent', 'delivered', 'opened', 'clicked', 'deferred', 'bounced', 'blocked', 'complaint', 'failed', 'not_configured',
];
