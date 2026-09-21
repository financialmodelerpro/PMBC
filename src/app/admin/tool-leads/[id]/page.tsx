import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { ToolLeadActions } from '@/components/admin/tools/ToolLeadActions';
import { findTool } from '@/config/tools';
import { ADMIN_COLORS, adminBadge, adminCard, adminPageMain } from '@/lib/admin/styles';
import { emailStatusLabel } from '@/lib/tools/admin';
import type { ToolLeadEventRow } from '@/lib/tools/db';
import { dealSizeLabel } from '@/lib/tools/leads/deliver';
import { AUTOMATED_REASON_TEXT, automatedReasonOf } from '@/lib/tools/engagement';
import { getLead, getLeadEvents } from '@/lib/tools/leads/store';
import { PURPOSES, dataVersionLabel } from '@/lib/tools/valuation/data';
import { resolveExtras, type ValuationInputs, type ValuationResult } from '@/lib/tools/valuation/engine';
import {
  bridgeTable,
  fcfTable,
  headline,
  keyRatiosTable,
  amountUnit,
  fmtMultiple,
  normalisationRows,
  scenariosTable,
  sensitivityTable,
  sensitivityTitle,
  warningTexts,
  type Table,
} from '@/lib/tools/valuation/format';
import { reviveResult } from '@/lib/tools/valuation/serialize';

export const metadata: Metadata = { title: 'Tool Lead | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const small: CSSProperties = { fontSize: 13, color: ADMIN_COLORS.textBody };
const muted: CSSProperties = { fontSize: 12, color: ADMIN_COLORS.textMuted };

function when(iso: string | null): string {
  if (!iso) return 'Not yet';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function Card({ title, children, span }: { title: string; children: ReactNode; span?: boolean }) {
  return (
    <section style={{ ...adminCard, gridColumn: span ? '1 / -1' : undefined, minWidth: 0 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 15, color: ADMIN_COLORS.textHeading }}>{title}</h2>
      {children}
    </section>
  );
}

function Pairs({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px, 40%) 1fr', gap: '6px 12px' }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt style={muted}>{k}</dt>
          <dd style={{ ...small, margin: 0, wordBreak: 'break-word' }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function MiniTable({ table }: { table: Table }) {
  const cell: CSSProperties = { padding: '5px 8px', borderBottom: `1px solid ${ADMIN_COLORS.borderSoft}`, fontSize: 12, whiteSpace: 'nowrap' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={i} style={{ ...cell, textAlign: i ? 'right' : 'left', color: ADMIN_COLORS.textMuted, background: ADMIN_COLORS.altBg }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri}>
              <td style={{ ...cell, fontWeight: r.tone === 'strong' ? 700 : 400, color: r.tone === 'muted' ? ADMIN_COLORS.textMuted : undefined }}>{r.label}</td>
              {r.values.map((v, ci) => (
                <td key={ci} style={{ ...cell, textAlign: 'right', fontWeight: r.tone === 'strong' ? 700 : 400 }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  email_sent: 'Results email sent',
  email_resent: 'Results email resent',
  email_failed: 'Results email failed',
  email_not_configured: 'Results email not sent: email not configured',
  email_skipped: 'Results email skipped',
  pdf_failed: 'PDF report failed to render',
  alert_sent: 'Internal alert sent',
  alert_failed: 'Internal alert failed',
  booking_click: 'Book a call clicked',
  booking_link: 'Booking link created',
  version_saved: 'Visitor emailed an updated version',
  sent: 'Accepted by Brevo',
  delivered: 'Delivered',
  opened: 'Opened (weak signal)',
  clicked: 'Link clicked',
  bounced: 'Bounced',
  soft_bounced: 'Soft bounce',
  complaint: 'Marked as spam',
  blocked: 'Blocked',
  deferred: 'Deferred',
  unsubscribed: 'Unsubscribed',
  error: 'Delivery error',
};

const PLACEMENTS: Record<string, string> = { results: 'from the results page', email: 'from the results email', pdf: 'from the PDF report' };

/** "Results email, from Brevo", "from the PDF report", and so on. */
function eventContext(e: ToolLeadEventRow): string {
  if (e.event_type === 'booking_click') return PLACEMENTS[e.detail ?? ''] ?? '';
  const parts: string[] = [];
  if (e.email_kind) parts.push(e.email_kind === 'alert' ? 'Internal alert, not visitor engagement' : 'Results email');
  if (e.source === 'brevo') parts.push('from Brevo');
  if (e.source === 'admin') parts.push('by staff');
  if (e.source === 'results' && e.event_type !== 'version_saved') parts.push('by the visitor');
  return parts.join(', ');
}

/** One replaced version: when it was replaced and what it said. */
type VersionEntry = { at: string; midpoint: string; range: string; growth: string; exitMultiple: string; waccAdjustment: string };

function versionHistory(events: ToolLeadEventRow[]): VersionEntry[] {
  const out: VersionEntry[] = [];
  for (const e of events) {
    if (e.event_type !== 'version_saved') continue;
    const prev = (e.payload as { previous?: { inputs?: ValuationInputs; results?: unknown } } | null)?.previous;
    if (!prev?.results || !prev.inputs) continue;
    try {
      const h = headline(reviveResult(prev.results));
      const adj = prev.inputs.waccAdjustment;
      out.push({
        at: e.occurred_at,
        midpoint: h.table.midpoint,
        range: h.table.equityRange,
        growth: `${prev.inputs.growth}%`,
        exitMultiple: `${prev.inputs.exitMultiple}x`,
        waccAdjustment: adj ? `${adj > 0 ? '+' : ''}${adj} points` : 'None',
      });
    } catch {
      // A payload this page cannot read is still listed in the event history.
    }
  }
  return out;
}

/** Whether the stored result carries the version 2 blocks (warnings then, checks from version 3). Leads saved before it do not. */
function isV2(r: ValuationResult): boolean {
  return (Array.isArray(r.warnings) || Array.isArray(r.checks)) && Boolean(r.stake);
}

function eventTone(e: ToolLeadEventRow): 'neutral' | 'success' | 'warning' | 'danger' {
  // Staff opening the alert, and likely automated clicks, are never engagement.
  if (e.email_kind === 'alert' && ['clicked', 'opened', 'delivered'].includes(e.event_type)) return 'neutral';
  if (automatedReasonOf(e.payload)) return 'neutral';
  if (['bounced', 'complaint', 'blocked', 'error', 'email_failed', 'alert_failed', 'pdf_failed'].includes(e.event_type)) return 'danger';
  if (['clicked', 'booking_click', 'delivered'].includes(e.event_type)) return 'success';
  if (['deferred', 'soft_bounced', 'email_not_configured'].includes(e.event_type)) return 'warning';
  return 'neutral';
}

export default async function ToolLeadDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ lead, missingTable }, events] = await Promise.all([getLead(id), getLeadEvents(id)]);

  if (missingTable) {
    return (
      <div style={adminPageMain}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <AdminPageHeader eyebrow="Leads" title="Tool lead" />
          <MigrationNotice migration="077_tool_leads.sql" table="tool_leads" effect="There are no leads to show until it is applied." />
        </div>
      </div>
    );
  }
  if (!lead) notFound();

  const result = reviveResult(lead.results);
  const h = headline(result);
  const inputs = lead.inputs as ValuationInputs;
  const tool = findTool(lead.tool_slug);
  const es = emailStatusLabel(lead.email_status);
  const as = emailStatusLabel(lead.alert_status);
  const purpose = PURPOSES.find((p) => p.value === lead.purpose)?.label ?? lead.purpose ?? 'Not given';
  const years = [...result.years.history.map((y) => `FY${y} A`), ...result.years.forecast.map((y) => `FY${y} F`)];
  const n = (v: number | null) => (v === null || v === undefined ? '' : String(v));
  const inputTable: Table = {
    head: [`${result.currency.code} millions`, ...years],
    rows: (
      [
        ['Revenue', 'rev'],
        ['EBITDA', 'ebitda'],
        ['D&A', 'da'],
        ['Capex', 'capex'],
        ['Net working capital', 'nwc'],
      ] as const
    ).map(([label, k]) => ({ label, values: inputs.financials[k].map(n) })),
  };
  const w = inputs.wacc;
  const v2 = isV2(result);
  const extras = resolveExtras(inputs);
  const warnings = v2 ? warningTexts(result) : [];
  const versions = versionHistory(events);
  const automatedClicks = events.filter((e) => (e.event_type === 'booking_click' || e.event_type === 'clicked') && automatedReasonOf(e.payload)).length;
  const code = result.currency.code;
  const opt = (v: number | null | undefined, unit = '') => (v === null || v === undefined ? 'Not entered' : `${v}${unit}`);
  const signed = (v: number | null | undefined) => (v ? `${v > 0 ? '+' : ''}${v} points` : 'None');

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>
          <Link href="/admin/tool-leads" style={{ color: ADMIN_COLORS.primary }}>
            All tool leads
          </Link>
        </p>
        <AdminPageHeader
          eyebrow={tool?.name ?? lead.tool_slug}
          title={lead.company ? `${lead.name}, ${lead.company}` : lead.name}
          description={`Received ${when(lead.created_at)}. ${dataVersionLabel(lead.data_version)} (data version ${lead.data_version}).`}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: -16, marginBottom: 20 }}>
          {lead.is_test && <span style={adminBadge('warning')}>Test lead</span>}
          {lead.below_minimum && <span style={adminBadge('neutral')}>Below minimum</span>}
          <span style={adminBadge(es.tone)}>Email: {es.label}</span>
          {lead.booking_clicks > 0 && <span style={adminBadge('success')}>Booking clicks: {lead.booking_clicks}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <Card title="Contact and consent">
            <Pairs
              rows={[
                ['Name', lead.name],
                ['Email', <a key="e" href={`mailto:${lead.email}`}>{lead.email}</a>],
                ['Company', lead.company || 'Not given'],
                ['Purpose', purpose],
                ['Planned transaction size', dealSizeLabel(lead.deal_size_band, lead.country)],
                ['Consent', lead.consent_given ? `Given ${when(lead.consent_at)}` : 'Not recorded'],
                ['Consent wording', <span key="c" style={muted}>{lead.consent_text}</span>],
                ['Follow-up email', lead.follow_up_consent ? `Yes, ${when(lead.follow_up_consent_at)}` : 'No'],
              ]}
            />
          </Card>

          <Card title="Actions">
            <ToolLeadActions id={lead.id} status={lead.status} notes={lead.notes} email={lead.email} />
          </Card>

          <Card title="Stored results" span>
            <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>{h.equityRange}</p>
            <p style={{ ...small, margin: '0 0 12px' }}>
              Base case {h.midpoint}, equity value {h.asAt}. Enterprise value {h.evRange}. WACC {h.wacc}. Terminal value share {h.tvShare}.
              Implied EV / LTM EBITDA {h.ltmMultiple}. Implied terminal multiple (perpetuity method) {h.impliedExitMultiple}.
            </p>
            {h.floorNote && <p style={{ ...small, margin: '0 0 12px', color: ADMIN_COLORS.warning }}>{h.floorNote}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
              <div>
                <p style={{ ...muted, margin: '0 0 6px' }}>Enterprise to equity</p>
                <MiniTable table={bridgeTable(result)} />
                <p style={{ ...muted, margin: '14px 0 6px' }}>{sensitivityTitle(result)}</p>
                <MiniTable table={sensitivityTable(result)} />
              </div>
              <div>
                <p style={{ ...muted, margin: '0 0 6px' }}>Free cash flow</p>
                <MiniTable table={fcfTable(result)} />
              </div>
            </div>
          </Card>

          {v2 && (
            <Card title="Scenarios, stake and checks" span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
                <div>
                  <p style={{ ...muted, margin: '0 0 6px' }}>Scenarios</p>
                  {result.scenarios.length ? <MiniTable table={scenariosTable(result)} /> : <p style={{ ...small, margin: 0 }}>Not run.</p>}
                  <p style={{ ...muted, margin: '14px 0 6px' }}>Stake</p>
                  <p style={{ ...small, margin: 0 }}>{h.table.stakeRange ? `${h.stakeLabel}: ${h.table.stakeRange}` : 'Whole business, no premium or discount.'}</p>
                  <p style={{ ...muted, margin: '14px 0 6px' }}>Normalised EBITDA ({amountUnit(result).label})</p>
                  {result.normalisation.used ? (
                    <Pairs rows={normalisationRows(result)} />
                  ) : (
                    <p style={{ ...small, margin: 0 }}>No adjustments entered. Reported EBITDA used.</p>
                  )}
                </div>
                <div>
                  <p style={{ ...muted, margin: '0 0 6px' }}>Checks that raised a warning for the visitor ({warnings.length})</p>
                  {warnings.length === 0 ? (
                    <p style={{ ...small, margin: 0 }}>None triggered.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {warnings.map((wt) => (
                        <li key={wt.code} style={{ ...small, marginBottom: 8 }}>
                          <strong>{wt.title}.</strong> {wt.detail}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p style={{ ...muted, margin: '14px 0 6px' }}>Key ratios</p>
                  <MiniTable table={keyRatiosTable(result)} />
                </div>
              </div>
            </Card>
          )}

          <Card title="Stored inputs" span>
            <Pairs
              rows={[
                ['Industry', inputs.industry],
                ['Country', `${inputs.country} (${result.currency.code})`],
                ['Last financial year', n(inputs.financialYear)],
                ...(inputs.debt !== null && inputs.debt !== undefined
                  ? ([
                      ['Borrowings', `${n(inputs.debt)} ${result.currency.code} m`],
                      ['Cash', `${n(inputs.cash ?? null)} ${result.currency.code} m`],
                      ['Net debt (borrowings less cash)', `${n(Math.round((inputs.debt - (inputs.cash ?? 0)) * 1e6) / 1e6)} ${result.currency.code} m`],
                    ] as [string, string][])
                  : ([['Net debt', `${n(inputs.netDebt)} ${result.currency.code} m`]] as [string, string][])),
              ]}
            />
            <div style={{ marginTop: 12 }}>
              <MiniTable table={inputTable} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 14 }}>
              <Pairs
                rows={[
                  ['Risk-free rate', `${n(w.rf)}%`],
                  ['Equity risk premium', `${n(w.erp)}%`],
                  ['Country risk premium', `${n(w.crp)}%`],
                  ['Unlevered beta', n(w.bu)],
                  ['Debt to equity', `${n(w.de)}%`],
                  ['Size premium', `${n(w.sp)}%`],
                  ['Default spread', `${n(w.ds)}%`],
                  ['Credit spread', `${n(w.cs)}%`],
                  ['Own borrowing rate', w.kd !== null && w.kd !== undefined ? `${n(w.kd)}% ${result.currency.code}, replaces the spreads` : 'Not entered, built from the spreads'],
                  ['Corporate income tax rate', `${n(w.tax)}%`],
                  ...(inputs.country === 'Saudi Arabia'
                    ? ([
                        ['Saudi / GCC ownership', (inputs.schemaVersion ?? 1) >= 3 ? `${extras.gccOwnership}%` : 'Not asked (saved before version 3); valued on corporate tax'],
                        ['Zakat rate', `${inputs.zakatRate ?? 2.5}%`],
                        // From version 4 cash is entered with borrowings and listed above; before it, cash fed the zakat base only.
                        ...(inputs.debt === null || inputs.debt === undefined
                          ? ([['Cash at year end (zakat base only)', inputs.cash === null || inputs.cash === undefined ? 'Not entered' : `${inputs.cash} ${result.currency.code} m`]] as [string, string][])
                          : []),
                      ] as [string, string][])
                    : []),
                  ...(result.currency.pegged
                    ? []
                    : ([
                        ['Local inflation', `${n(w.inflationLocal)}%`],
                        ['US inflation', `${n(w.inflationUs)}%`],
                      ] as [string, string][])),
                ]}
              />
              <Pairs
                rows={[
                  ['Long-term growth', `${n(inputs.growth)}%`],
                  ['Exit multiple', `${n(inputs.exitMultiple)}x`],
                  ['Discounting', inputs.midYear ? 'Mid-year' : 'End of year'],
                  ['Private company discount', `${n(inputs.privateDiscount)}%`],
                  ['DCF weight', `${n(inputs.dcfWeight)}%`],
                  ['Exit multiple used', v2 ? `${fmtMultiple(result.exitMultipleApplied)} after the discount` : 'As entered (saved before version 2)'],
                  ['WACC adjustment', signed(inputs.waccAdjustment)],
                  [
                    'Peers',
                    inputs.peers.length
                      ? inputs.peers.map((p) => `${p.name || 'Unnamed'} (${n(p.evEbitda)}x, ${n(p.evRevenue)}x${p.evEbit !== null && p.evEbit !== undefined ? `, EV / EBIT ${p.evEbit}x` : ''})`).join('; ')
                      : 'None, preset multiples used',
                  ],
                ]}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 14 }}>
              <Pairs
                rows={[
                  ['Company name, as typed in step 1', inputs.profile?.companyName ?? 'Not entered'],
                  [
                    'About the business',
                    inputs.profile?.description ? (
                      <span key="about" style={{ whiteSpace: 'pre-line' }}>
                        {inputs.profile.description}
                      </span>
                    ) : (
                      'Not entered'
                    ),
                  ],
                  ['Input schema version', String(inputs.schemaVersion ?? 1)],
                  ['Valuation date', inputs.valuationDate ?? 'Not recorded (saved before version 3)'],
                  ['Amount to raise', inputs.raiseAmount === null || inputs.raiseAmount === undefined ? 'Not entered' : `${inputs.raiseAmount} ${code} m`],
                  ['One-off costs added back', opt(extras.normalisation.oneOff, ` ${code} m`)],
                  ['Owner costs added back', opt(extras.normalisation.ownerCosts, ` ${code} m`)],
                  ['Carry owner costs into forecast', extras.normalisation.carryOwnerCosts ? 'Yes' : 'No'],
                  ['Invested capital', inputs.investedCapitalParts?.fixedAssets !== null && inputs.investedCapitalParts?.fixedAssets !== undefined ? `working capital ${inputs.investedCapitalParts.workingCapital ?? 'from the financials'} plus fixed assets ${inputs.investedCapitalParts.fixedAssets} ${code} m` : opt(inputs.investedCapital, ` ${code} m`)],
                  ['End of service benefits', opt(extras.bridge.eosb, ` ${code} m`)],
                  ['Lease liabilities', opt(extras.bridge.leases, ` ${code} m`)],
                  ['Minority interest', opt(extras.bridge.minorityInterest, ` ${code} m`)],
                  ['Surplus assets', opt(extras.bridge.surplusAssets, ` ${code} m`)],
                ]}
              />
              <Pairs
                rows={[
                  ['Stake', opt(extras.stake.percent, '%')],
                  [
                    'Stake adjustment',
                    extras.stake.adjustment === 'control_premium'
                      ? `Control premium ${opt(extras.stake.controlPremium, '%')}`
                      : extras.stake.adjustment === 'minority_discount'
                        ? `Minority discount ${opt(extras.stake.minorityDiscount, '%')}`
                        : 'None',
                  ],
                  ['Upside', `${opt(extras.scenarios.upsideGrowth, ' points')} growth, ${opt(extras.scenarios.upsideMargin, ' points')} margin`],
                  ['Downside', `${opt(extras.scenarios.downsideGrowth, ' points')} growth, ${opt(extras.scenarios.downsideMargin, ' points')} margin`],
                  [
                    'Weights',
                    `Downside ${opt(extras.scenarios.weightDownside, '%')}, base ${opt(extras.scenarios.weightBase, '%')}, upside ${opt(extras.scenarios.weightUpside, '%')}`,
                  ],
                ]}
              />
            </div>
          </Card>

          {versions.length > 0 && (
            <Card title={`Version history (${versions.length})`} span>
              <p style={{ ...muted, margin: '0 0 10px', lineHeight: 1.5 }}>
                Each time the visitor used Email me this version, the stored inputs and results above were replaced, and the version replaced is kept
                here. Most recent first.
              </p>
              <MiniTable
                table={{
                  head: ['Replaced', 'Equity range', 'Base case', 'Growth', 'Exit multiple', 'WACC adjustment'],
                  rows: versions.map((vv) => ({ label: when(vv.at), values: [vv.range, vv.midpoint, vv.growth, vv.exitMultiple, vv.waccAdjustment] })),
                }}
              />
            </Card>
          )}

          <Card title="Email">
            <Pairs
              rows={[
                ['Results email', <span key="r" style={adminBadge(es.tone)}>{es.label}</span>],
                ['Sent', when(lead.email_sent_at)],
                ['Last event', when(lead.email_last_event_at)],
                ['Brevo message id', <code key="m" style={{ fontSize: 11 }}>{lead.email_message_id ?? 'None'}</code>],
                ...(lead.email_error ? ([['Error', <span key="err" style={{ color: ADMIN_COLORS.danger }}>{lead.email_error}</span>]] as [string, ReactNode][]) : []),
                ['Internal alert', <span key="a" style={adminBadge(as.tone)}>{as.label}</span>],
                ...(lead.alert_error ? ([['Alert error', <span key="aerr" style={{ color: ADMIN_COLORS.danger }}>{lead.alert_error}</span>]] as [string, ReactNode][]) : []),
                ['Booking clicks', `${lead.booking_clicks}${lead.last_booking_click_at ? `, last ${when(lead.last_booking_click_at)}` : ''}${automatedClicks ? `. ${automatedClicks} likely automated ${automatedClicks === 1 ? 'click' : 'clicks'} not counted` : ''}`],
              ]}
            />
            <p style={{ ...muted, margin: '12px 0 0', lineHeight: 1.5 }}>
              Opens are a weak signal: mail privacy features and image proxies open messages no one read. Clicks and booking clicks are the real signal.
            </p>
          </Card>

          <Card title="Attribution">
            <Pairs
              rows={[
                ['UTM source', lead.utm_source ?? ''],
                ['UTM medium', lead.utm_medium ?? ''],
                ['UTM campaign', lead.utm_campaign ?? ''],
                ['UTM term', lead.utm_term ?? ''],
                ['UTM content', lead.utm_content ?? ''],
                ['Referrer', lead.referrer ?? 'Direct or not recorded'],
                ['Landing page', lead.landing_path ?? ''],
                ['User agent', <span key="ua" style={muted}>{lead.user_agent ?? ''}</span>],
                ['IP hash', <code key="ip" style={{ fontSize: 11 }}>{lead.ip_hash ? `${lead.ip_hash.slice(0, 16)}...` : 'None'}</code>],
              ]}
            />
          </Card>

          <Card title="Event history" span>
            {events.length === 0 ? (
              <p style={{ ...small, margin: 0 }}>No events yet. Email sends are recorded within a few seconds of the lead arriving.</p>
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {events.map((e) => (
                  <li key={e.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${ADMIN_COLORS.borderSoft}`, flexWrap: 'wrap' }}>
                    <span style={{ ...muted, minWidth: 170 }}>{when(e.occurred_at)}</span>
                    <span style={adminBadge(eventTone(e))}>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                    <span style={muted}>{eventContext(e)}</span>
                    {e.link && <span style={{ ...muted, wordBreak: 'break-all' }}>{e.link}</span>}
                    {automatedReasonOf(e.payload) && (
                      <span style={adminBadge('warning')} title="Kept in history. Not counted in email status or booking clicks.">
                        {AUTOMATED_REASON_TEXT[automatedReasonOf(e.payload)!]}, not counted
                      </span>
                    )}
                    {e.detail && e.event_type !== 'booking_click' && !automatedReasonOf(e.payload) && <span style={{ ...small }}>{e.detail}</span>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
