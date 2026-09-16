import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
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
import { EMAIL_STATUS_FILTERS, LEAD_PAGE_SIZE, emailStatusLabel, listLeads, parseLeadFilters } from '@/lib/tools/admin';
import { dealSizeLabel } from '@/lib/tools/leads/deliver';
import { DEAL_BANDS_SAR, DEAL_BAND_UNSURE } from '@/lib/tools/valuation/data';

export const metadata: Metadata = { title: 'Tool Leads | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function money(v: number | null, currency: string | null): string {
  if (v === null || v === undefined) return '';
  const n = Number(v);
  return `${currency ?? ''} ${n >= 1000 ? (n / 1000).toFixed(2) + 'bn' : n.toFixed(n >= 100 ? 0 : 1) + 'm'}`.trim();
}

export default async function ToolLeadsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await props.searchParams;
  const f = parseLeadFilters(search);
  const { rows, total, missingTable, error } = await listLeads(f);
  const pages = Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE));
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
          description="Everyone who ran a free tool and asked for their results. Inputs and results are stored exactly as the visitor was shown them."
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

        <div style={{ ...adminCard, padding: 0, overflowX: 'auto' }}>
          <table style={adminTable}>
            <thead style={adminThead}>
              <tr>
                <th style={adminTh}>Received</th>
                <th style={adminTh}>Name</th>
                <th style={adminTh}>Tool</th>
                <th style={adminTh}>Deal size</th>
                <th style={{ ...adminTh, textAlign: 'right' }}>Equity midpoint</th>
                <th style={adminTh}>Email</th>
                <th style={adminTh}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...adminTd, color: ADMIN_COLORS.textMuted, textAlign: 'center', padding: 28 }}>
                    {missingTable ? 'No table yet.' : 'No leads match these filters.'}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const es = emailStatusLabel(r.email_status);
                return (
                  <tr key={r.id}>
                    <td style={{ ...adminTd, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={adminTd}>
                      <Link href={`/admin/tool-leads/${r.id}`} style={{ fontWeight: 600, color: ADMIN_COLORS.primary, textDecoration: 'none' }}>
                        {r.name}
                      </Link>
                      <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                        {r.email}
                        {r.company ? `, ${r.company}` : ''}
                      </div>
                      {r.is_test && <span style={adminBadge('warning')}>Test</span>}
                    </td>
                    <td style={{ ...adminTd, fontSize: 13 }}>{TOOLS.find((t) => t.slug === r.tool_slug)?.name ?? r.tool_slug}</td>
                    <td style={{ ...adminTd, fontSize: 13 }}>
                      {dealSizeLabel(r.deal_size_band, r.country)}
                      {r.below_minimum && (
                        <div>
                          <span style={adminBadge('neutral')}>Below minimum</span>
                        </div>
                      )}
                    </td>
                    <td style={{ ...adminTd, fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.equity_mid, r.currency)}</td>
                    <td style={adminTd}>
                      <span style={adminBadge(es.tone)}>{es.label}</span>
                      {r.booking_clicks > 0 && <div style={{ fontSize: 12, marginTop: 4 }}>Booking clicks: {r.booking_clicks}</div>}
                    </td>
                    <td style={{ ...adminTd, fontSize: 13, textTransform: 'capitalize' }}>{r.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13, color: ADMIN_COLORS.textMuted }}>
          <span>
            {total} {total === 1 ? 'lead' : 'leads'}
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
