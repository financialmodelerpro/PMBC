/**
 * Read models for the admin Tools and Tool leads screens.
 *
 * Every function reports `missingTable` instead of throwing, which is how the
 * screens show "migration not applied" rather than an error page.
 */

import { isMissingSchema, toolsDb, type EmailStatus, type ToolLeadRow } from './db';

export const TOOL_VISIBILITY_AUDIT = { entityType: 'tool', action: 'tool_visibility' } as const;

export type LeadCounts = { total: number; last30: number };

/**
 * Leads per tool, one per person (distinct email) since 2026-09-21: a person who ran three valuations
 * is one lead with three projects. `projects` keeps the count of valuations.
 */
export async function leadCountsBySlug(slugs: string[]): Promise<{ counts: Record<string, LeadCounts & { projects: number }>; missingTable: boolean }> {
  const counts: Record<string, LeadCounts & { projects: number }> = {};
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  let missingTable = false;
  await Promise.all(
    slugs.map(async (slug) => {
      const { data, error } = await toolsDb().from('tool_leads').select('email, created_at').eq('tool_slug', slug).eq('is_test', false).limit(20000);
      if (isMissingSchema(error)) missingTable = true;
      const rows = (data ?? []) as { email: string; created_at: string }[];
      counts[slug] = { total: countPeople(rows), last30: countPeople(rows.filter((r) => r.created_at >= since)), projects: rows.length };
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

/* ------------------------------------------------------------------------ */
/* People: leads grouped by email (since 2026-09-21)                         */
/* ------------------------------------------------------------------------ */

/**
 * One email is one lead: a person. Each valuation they run is a project under them, named by its
 * company, or "Your business" when none was given; "Email me this version" and the save and return
 * link add versions to a project, never new projects. Grouping is by email, case-insensitive, over
 * every tool_leads row, so leads saved before 2026-09-21 group the same way. Pure: the verifiers
 * drive it directly.
 */
export type ProjectRow = LeadListRow & { phone?: string | null; contact_country?: string | null; follow_up_consent?: boolean };

export type Person = {
  email: string;
  /** The most recent name, phone and country the person gave. */
  name: string;
  phone: string | null;
  contactCountry: string | null;
  projects: (ProjectRow & { projectName: string })[];
  latestAt: string;
  firstAt: string;
  bookingClicks: number;
  belowMinimum: boolean;
  isTest: boolean;
};

export const UNNAMED_PROJECT = 'Your business';

export function projectName(company: string | null | undefined): string {
  return company?.trim() || UNNAMED_PROJECT;
}

export function groupLeadsByEmail(rows: ProjectRow[]): Person[] {
  const byEmail = new Map<string, ProjectRow[]>();
  for (const r of rows) {
    const key = r.email.trim().toLowerCase();
    const list = byEmail.get(key);
    if (list) list.push(r);
    else byEmail.set(key, [r]);
  }
  const people: Person[] = [];
  for (const [email, list] of byEmail) {
    const projects = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((p) => ({ ...p, projectName: projectName(p.company) }));
    const latest = projects[0];
    people.push({
      email,
      name: latest.name,
      phone: projects.find((p) => p.phone)?.phone ?? null,
      contactCountry: projects.find((p) => p.contact_country)?.contact_country ?? null,
      projects,
      latestAt: latest.created_at,
      firstAt: projects[projects.length - 1].created_at,
      bookingClicks: projects.reduce((s, p) => s + (p.booking_clicks ?? 0), 0),
      belowMinimum: projects.some((p) => p.below_minimum),
      isTest: projects.every((p) => p.is_test),
    });
  }
  return people.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

/** Distinct emails among rows: the lead count, one per person. */
export function countPeople(rows: { email: string }[]): number {
  return new Set(rows.map((r) => r.email.trim().toLowerCase())).size;
}

const PEOPLE_COLUMNS = 'id, created_at, tool_slug, is_test, name, email, company, deal_size_band, below_minimum, country, currency, equity_mid, status, email_status, booking_clicks, follow_up_consent';
/** More than the admin will see in years at this volume; the page groups what it reads. */
const PEOPLE_READ_CAP = 5000;

/**
 * People for the admin list: every row matching the filters, grouped by email, then one page of
 * people. The phone columns come from migration 082; before it the read is retried without them.
 */
export async function listPeople(f: LeadFilters): Promise<{ people: Person[]; total: number; projects: number; missingTable: boolean; error: string | null }> {
  try {
    const run = (cols: string) => {
      let q = toolsDb().from('tool_leads').select(cols).order('created_at', { ascending: false }).limit(PEOPLE_READ_CAP);
      if (f.tool) q = q.eq('tool_slug', f.tool);
      if (f.from) q = q.gte('created_at', `${f.from}T00:00:00Z`);
      if (f.to) q = q.lte('created_at', `${f.to}T23:59:59.999Z`);
      if (f.deal) q = q.eq('deal_size_band', f.deal);
      if (f.belowMin) q = q.eq('below_minimum', f.belowMin === 'yes');
      if (f.email) q = q.eq('email_status', f.email);
      if (!f.includeTest) q = q.eq('is_test', false);
      return q;
    };
    let { data, error } = await run(`${PEOPLE_COLUMNS}, phone, contact_country`);
    if (error && /phone|contact_country/.test(error.message ?? '')) ({ data, error } = await run(PEOPLE_COLUMNS));
    if (error) return { people: [], total: 0, projects: 0, missingTable: isMissingSchema(error), error: isMissingSchema(error) ? null : error.message };
    const rows = (data ?? []) as unknown as ProjectRow[];
    const all = groupLeadsByEmail(rows);
    const start = (f.page - 1) * LEAD_PAGE_SIZE;
    return { people: all.slice(start, start + LEAD_PAGE_SIZE), total: all.length, projects: rows.length, missingTable: false, error: null };
  } catch (err) {
    return { people: [], total: 0, projects: 0, missingTable: false, error: err instanceof Error ? err.message : 'load failed' };
  }
}

/** Versions saved per project (the `version_saved` events), for the projects on one page. */
export async function versionCounts(leadIds: string[]): Promise<Record<string, number>> {
  if (!leadIds.length) return {};
  try {
    const { data } = await toolsDb().from('tool_lead_events').select('lead_id').eq('event_type', 'version_saved').in('lead_id', leadIds);
    const out: Record<string, number> = {};
    for (const e of (data ?? []) as { lead_id: string }[]) out[e.lead_id] = (out[e.lead_id] ?? 0) + 1;
    return out;
  } catch {
    return {};
  }
}

/** Every project of one person, for the project page's "other valuations by this person". */
export async function projectsForEmail(email: string): Promise<ProjectRow[]> {
  try {
    const { data } = await toolsDb().from('tool_leads').select(PEOPLE_COLUMNS).eq('email', email.trim().toLowerCase()).order('created_at', { ascending: false }).limit(200);
    return (data ?? []) as unknown as ProjectRow[];
  } catch {
    return [];
  }
}
