import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { type PersonView, ToolLeadsTable } from '@/components/admin/tools/ToolLeadsTable';
import { TOOLS } from '@/config/tools';
import {
  ADMIN_COLORS,
  adminBadge,
  adminButtonGhost,
  adminButtonPrimary,
  adminCard,
  adminInput,
  adminLabel,
  adminPageMain,
  adminTable,
  adminTd,
  adminTh,
  adminThead,
} from '@/lib/admin/styles';
import { type Person, EMAIL_STATUS_FILTERS, LEAD_PAGE_SIZE, emailStatusLabel, listPeople, parseLeadFilters, versionCounts } from '@/lib/tools/admin';
import { dealSizeLabel } from '@/lib/tools/leads/deliver';
import { DEAL_BANDS_SAR, DEAL_BAND_UNSURE } from '@/lib/tools/valuation/data';

export const metadata: Metadata = { title: 'Tool Leads | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The base case in full, as the report's tables print amounts: "SAR 385.2 million", or thousands
 * under 10 million ("SAR 4,250 thousand"). The row carries only the equity figure, so its size
 * picks the unit, where the report also looks at revenue.
 */
function money(v: number | null, currency: string | null): string {
  if (v === null || v === undefined) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const small = Math.abs(n) < 10;
  const x = small ? n * 1000 : n;
  const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: small ? 0 : 1, maximumFractionDigits: small ? 0 : 1 });
  return `${currency ?? ''} ${x < 0 ? `(${s})` : s} ${small ? 'thousand' : 'million'}`.trim();
}

export default async function ToolLeadsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await props.searchParams;
  const f = parseLeadFilters(search);
  // One lead per email (since 2026-09-21): each person, with their valuations as projects beneath.
  const { people, total, projects, missingTable, error } = await listPeople(f);
  const versions = await versionCounts(people.flatMap((p) => p.projects.map((x) => x.id)));
  const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const pages = Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE));
  // Whether a person's row may be hiding valuations: deleting a person always deletes all of them.
  const filtered = Boolean(f.tool || f.from || f.to || f.deal || f.belowMin || f.email || !f.includeTest);
  const view: PersonView[] = people.map((p) => toView(p, versions, when));
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) if (typeof v === 'string' && v && k !== 'page') q.set(k, v);
    q.set('page', String(p));
    return `/admin/tool-leads?${q.toString()}`;
  };

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Leads"
          title="Tool Leads"
          description="One lead per email. Each valuation a person runs is a project under them, named by its company; emailed versions and save and return runs are versions of a project. Inputs and results are stored exactly as the visitor was shown them. Open a lead with its arrow to see its valuations. Deleting a lead removes every valuation under its email."
        />
        {missingTable && (
          <MigrationNotice migration="077_tool_leads.sql" table="tool_leads" effect="Visitors still see their results, but nothing is saved or emailed until it is applied." />
        )}
        {error && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not load leads: {error}</p>}

        <form method="get" style={{ ...adminCard, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={adminLabel}>Tool</span>
            <select name="tool" defaultValue={f.tool} style={{ ...adminInput, minWidth: 180 }}>
              <option value="">All tools</option>
              {TOOLS.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={adminLabel}>From</span>
            <input type="date" name="from" defaultValue={f.from} style={adminInput} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={adminLabel}>To</span>
            <input type="date" name="to" defaultValue={f.to} style={adminInput} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={adminLabel}>Deal size (SAR)</span>
            <select name="deal" defaultValue={f.deal} style={adminInput}>
              <option value="">Any</option>
              {DEAL_BANDS_SAR.map((b) => (
                <option key={b.value} value={b.value}>
                  {dealSizeLabel(b.value, 'Saudi Arabia')}
                </option>
              ))}
              <option value={DEAL_BAND_UNSURE}>Not decided yet</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={adminLabel}>Below minimum</span>
            <select name="below" defaultValue={f.belowMin} style={adminInput}>
              <option value="">Either</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={adminLabel}>Email status</span>
            <select name="email" defaultValue={f.email} style={adminInput}>
              <option value="">Any</option>
              {EMAIL_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {emailStatusLabel(s).label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 8 }}>
            <input type="checkbox" name="test" value="1" defaultChecked={f.includeTest} />
            Include test leads
          </label>
          <button type="submit" style={adminButtonPrimary}>
            Filter
          </button>
          <Link href="/admin/tool-leads" style={{ ...adminButtonGhost, padding: '9px 14px' }}>
            Clear
          </Link>
        </form>

        <ToolLeadsTable people={view} filtered={filtered} emptyText={missingTable ? 'No table yet.' : 'No leads match these filters.'} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13, color: ADMIN_COLORS.textMuted }}>
          <span>
            {total} {total === 1 ? 'lead' : 'leads'} (one per email), {projects} {projects === 1 ? 'valuation' : 'valuations'}
            {f.includeTest ? ', including test leads' : ''}
          </span>
          {pages > 1 && (
            <span style={{ display: 'flex', gap: 8 }}>
              {f.page > 1 && <Link href={pageHref(f.page - 1)}>Previous</Link>}
              <span>
                Page {f.page} of {pages}
              </span>
              {f.page < pages && <Link href={pageHref(f.page + 1)}>Next</Link>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** A person and their valuations as plain values for the client table, newest valuation first. */
function toView(p: Person, versions: Record<string, number>, when: (iso: string) => string): PersonView {
  return {
    email: p.email,
    name: p.name,
    contactLine: `${p.phone || 'No phone'}${p.contactCountry ? `, ${p.contactCountry}` : ''}`,
    bookingClicks: p.bookingClicks,
    belowMinimum: p.belowMinimum,
    isTest: p.isTest,
    latestLabel: when(p.latestAt),
    valuations: p.projects.map((x) => {
      const es = emailStatusLabel(x.email_status);
      const v = versions[x.id] ?? 0;
      return {
        id: x.id,
        projectName: x.projectName,
        versionsLabel: v ? `${v + 1} versions` : '1 version',
        country: x.country ?? '',
        toolName: TOOLS.find((t) => t.slug === x.tool_slug)?.name ?? x.tool_slug,
        dealLabel: dealSizeLabel(x.deal_size_band, x.country),
        amount: money(x.equity_mid, x.currency),
        emailLabel: es.label,
        emailTone: es.tone,
        createdLabel: when(x.created_at),
      };
    }),
  };
}
