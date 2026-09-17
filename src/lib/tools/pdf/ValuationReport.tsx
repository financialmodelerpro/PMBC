/**
 * The branded PDF valuation report, rendered on the server with @react-pdf/renderer.
 *
 * EIGHT A4 PAGES, whatever the visitor used:
 *   1  Valuation at a glance: the cover
 *   2  Executive summary and financial profile
 *   3  Valuation summary: value by method, the bridge, low / base / high, pre and post-money
 *   4  Free cash flow, DCF and sensitivity
 *   5  Scenarios and the factors that could support a higher valuation
 *   6  Checks and key assumptions
 *   7  Methodology, sources and disclaimer
 * Pages 6 and 7 flow as one section, so a long check list or a long list of
 * comparable companies moves text down rather than adding a page.
 *   8  Working with PaceMakers: the partner, the services, the booking link and a QR code
 * Seven pages would need 6 and 7 on one page, which the check list, the
 * assumptions and the sources do not fit at the minimum type sizes (body
 * 8.5pt, tables 7.5pt), so the report is eight.
 *
 * ONE SOURCE. Every figure is a field of the `ValuationResult` the engine
 * produced, worded by `format.ts` and drawn by `charts.ts`, the modules the
 * results page uses too. Nothing here computes a value. Before rendering,
 * `assertReconciled` checks that the pages cannot contradict each other.
 *
 * BRAND MATERIAL (`meta.branding`, from `src/lib/tools/brand/fetch.ts`): the
 * logo from Header Settings on the cover and the closing page, and the partner
 * card from the founder profile on the closing page. Every piece is optional.
 * A section with nothing to report says so rather than disappearing, so the
 * page order never depends on the inputs. Blocks are kept whole
 * (`wrap={false}`) and each page is sized to hold its longest case, which
 * `verify-tool-email-pdf` checks by counting pages.
 */

import type { ReactNode } from 'react';
import { Document, Image, Link, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';

import { SERVICES } from '@/config/services';
import { findTool } from '@/config/tools';

import { PARTNER_RECORD_NOTE, type PartnerCard } from '../brand/partner';

import { PURPOSES, SOURCE_NOTES, dataVersionLabel } from '../valuation/data';
import { descriptionParagraphs } from '../valuation/profile';
import { isCanonicalResult, type ValuationResult } from '../valuation/engine';
import { equityRangeBar, footballFieldChart, revenueMarginChart, sensitivityHeatmap, waterfallChart } from '../valuation/charts';
import {
  INDICATIVE_NOTE,
  LABELS,
  PRE_MONEY_NOTE,
  RELIANCE_STATEMENT,
  TOOL_DISCLAIMER,
  bridgeTable,
  checkItems,
  comparablesRows,
  amountUnit,
  fmtAmount,
  dcfSummaryRows,
  disclosures,
  executiveSummary,
  fcfTable,
  headline,
  methodsUsed,
  normalisationRows,
  profileRatios,
  raiseTable,
  scenariosTable,
  sensitivityTitle,
  stakeLabel,
  taxNote,
  taxRows,
  terminalNote,
  terminalRows,
  timingRows,
  valueLevers,
  waccBuildRows,
  type Table,
} from '../valuation/format';
import { assertReconciled } from '../valuation/reconcile';
import { PdfChart } from './PdfChart';
import { QrCode } from './QrCode';
import { C, NO_LIGATURES, PAGE, registerFonts, s } from './theme';

export type ReportMeta = {
  preparedFor: string;
  company: string | null;
  industry: string;
  country: string;
  purpose: string | null;
  generatedAt: Date;
  dataVersion: string;
  /** Tracked booking link, which lands on the site's /book page. Also encoded in the QR code. */
  bookingHref: string;
  /** Logos and the partner card. Optional: every piece has a fallback. */
  branding?: ReportBranding | null;
  /** The visitor's own description of the business, already cleaned. Shown on the cover. */
  description?: string | null;
};

export type ReportBranding = {
  /** The logo for the navy cover, already resized. PNG. */
  logoOnDark: Buffer | null;
  /** The navy and gold logo for white pages (see `recolourGreenToGold`). PNG. */
  logoOnLight: Buffer | null;
  partner: PartnerCard | null;
  /** The partner portrait, resized to 360 by 450. JPEG. */
  partnerPhoto: Buffer | null;
};

/** Logo files are trimmed and about 5.2 to 1. Height is set, width follows. */
const LOGO_RATIO = 6113 / 1176;

/** The product name the site already uses for the tool, from the tool registry. */
export const PRODUCT_NAME = `PaceMakers ${findTool('business-valuation')?.name ?? 'Business Valuation'}`;

export const REPORT_PAGE_TITLES = [
  'Indicative Business Valuation',
  'Executive summary',
  'Valuation summary',
  'Free cash flow, DCF and sensitivity',
  'Scenarios and value factors',
  'Checks and key assumptions',
  'Methodology, sources and disclaimer',
  'Working with PaceMakers',
] as const;

const CREAM_ON_NAVY = '#E8DDC4';

/* ------------------------------------------------------------------------ */
/* Building blocks                                                           */
/* ------------------------------------------------------------------------ */

function Footer({ meta }: { meta: ReportMeta }) {
  return (
    <View style={s.footer} fixed>
      <Text>PaceMakers Business Consultants LLP. Indicative only.</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}  |  ${dataVersionLabel(meta.dataVersion)}`} />
    </View>
  );
}

function ContentPage({ title, meta, children }: { title: string; meta: ReportMeta; children: ReactNode }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.brandBar} fixed />
      <Text style={s.pageTitle}>{title}</Text>
      {children}
      <Footer meta={meta} />
    </Page>
  );
}

function Section({ title, sub, children, gap = 14 }: { title: string; sub?: string; children: ReactNode; gap?: number }) {
  return (
    <View style={{ marginBottom: gap }} wrap={false}>
      <View style={s.rule} />
      <Text style={s.h2}>{title}</Text>
      {sub && <Text style={s.sub}>{sub}</Text>}
      {children}
    </View>
  );
}

function DataTable({ table, firstColWidth = 34, colWidths }: { table: Table; firstColWidth?: number; colWidths?: number[] }) {
  const cols = table.head.length - 1;
  const widths = colWidths ?? [firstColWidth, ...new Array<number>(cols).fill((100 - firstColWidth) / cols)];
  const cell = (i: number, align: 'left' | 'right') => ({ width: `${widths[i]}%`, paddingVertical: 2.6, paddingHorizontal: 4, textAlign: align });
  return (
    <View style={{ borderWidth: 0.5, borderColor: C.border }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.tint }}>
        {table.head.map((h, i) => (
          <Text key={i} style={[cell(i, i === 0 ? 'left' : 'right'), { fontSize: 7.5, fontWeight: 600, color: C.muted }]}>
            {h}
          </Text>
        ))}
      </View>
      {table.rows.map((row, ri) => {
        const strong = row.tone === 'strong';
        const muted = row.tone === 'muted';
        return (
          <View key={ri} style={{ flexDirection: 'row', borderTopWidth: strong ? 1 : 0.5, borderTopColor: strong ? C.text : C.border }}>
            <Text style={[cell(0, 'left'), { fontSize: 8, fontWeight: strong ? 600 : 400, color: muted ? C.muted : C.text }]}>{row.label}</Text>
            {row.values.map((v, ci) => (
              <Text key={ci} style={[cell(ci + 1, 'right'), { fontSize: 8, fontWeight: strong ? 600 : 400, color: muted ? C.muted : C.text }]}>
                {v}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function KeyValues({ rows, labelWidth = '56%' }: { rows: [string, string][]; labelWidth?: string }) {
  return (
    <View>
      {rows.map(([k, v], i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
          <Text style={{ color: C.muted, fontSize: 8, width: labelWidth, paddingRight: 4 }}>{k}</Text>
          <Text style={{ fontWeight: 500, fontSize: 8, flex: 1, textAlign: 'right' }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Tiles({ items, columns }: { items: [string, string][]; columns?: number }) {
  const per = columns ?? items.length;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: C.border }}>
      {items.map(([k, v]) => (
        <View key={k} style={{ width: `${100 / per}%`, paddingVertical: 5, paddingHorizontal: 7, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.border }}>
          <Text style={{ fontSize: 7.5, color: C.muted }}>{k}</Text>
          <Text style={{ fontSize: 10.5, fontWeight: 600, marginTop: 2 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <Text style={[s.note, { fontSize: 8.5, marginTop: 4 }]}>{children}</Text>;
}

function Callout({ children }: { children: ReactNode }) {
  return <View style={{ borderLeftWidth: 2, borderLeftColor: C.gold, backgroundColor: C.cream, padding: 6, marginTop: 5 }}>{children}</View>;
}

function SubHead({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 11, marginBottom: 2, marginTop: 6 }}>{children}</Text>;
}

/* ------------------------------------------------------------------------ */
/* The report                                                                */
/* ------------------------------------------------------------------------ */

export function ValuationReport({ result, meta }: { result: ValuationResult; meta: ReportMeta }) {
  const r = result;
  const h = headline(r);
  const c = r.currency;
  const u = amountUnit(r);
  const unit = u.label;
  const amt = (v: number) => `${fmtAmount(v, u)} ${u.short}`;
  const purposeValue = r.meta.purpose ?? meta.purpose;
  const purpose = PURPOSES.find((p) => p.value === purposeValue)?.label;
  const dateText = meta.generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const who = meta.company || meta.preparedFor;
  const b = r.bridge;
  const bridgeItemsUsed = Boolean(b.eosb || b.leases || b.minorityInterest || b.surplusAssets);
  const W = PAGE.contentWidth;
  const brand = meta.branding ?? null;
  const partner = brand?.partner ?? null;
  const about = descriptionParagraphs(meta.description);
  const checks = checkItems(r);
  const warningCount = checks.filter((x) => x.status === 'warning').length;
  const notes = disclosures(r);
  const raise = raiseTable(r);
  const kpis: [string, string][] = [
    [LABELS.wacc, h.wacc],
    [LABELS.tvShare, h.tvShare],
    [LABELS.ltmMultiple, h.ltmMultiple],
    [LABELS.weighted, h.weighted ?? 'n/a'],
  ];
  // Long company names step down so the cover never runs onto a second page.
  const titleSize = who.length > 80 ? 20 : who.length > 44 ? 25 : 32;

  return (
    <Document title={`Indicative valuation, ${who}`} author="PaceMakers Business Consultants" subject="Indicative business valuation">
      {/* 1. Valuation at a glance */}
      <Page size="A4" style={{ fontFamily: 'Inter', fontFeatureSettings: NO_LIGATURES, backgroundColor: C.deep, color: C.white }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: C.gold }} />
        <View style={{ paddingHorizontal: 56, paddingTop: 56, flex: 1 }}>
          {brand?.logoOnDark ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={{ data: brand.logoOnDark, format: 'png' }} style={{ height: 32, width: 32 * LOGO_RATIO }} />
          ) : (
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 14 }}>PaceMakers Business Consultants</Text>
          )}
          <Text style={{ fontSize: 7.5, color: C.gold, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: brand?.logoOnDark ? 10 : 4 }}>Advisory from Structure to Exit</Text>

          <View style={{ marginTop: about.length ? 46 : 110 }}>
            <View style={{ height: 1.5, width: 64, backgroundColor: C.gold, marginBottom: 16 }} />
            <Text style={{ fontSize: 8.5, color: C.gold, letterSpacing: 1.6, textTransform: 'uppercase' }}>{REPORT_PAGE_TITLES[0]}</Text>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: titleSize, lineHeight: 1.1, marginTop: 10 }}>{who}</Text>
            <Text style={{ fontSize: 10, color: CREAM_ON_NAVY, marginTop: 8 }}>
              {meta.industry}, {meta.country}. Prepared {dateText}.
            </Text>
          </View>

          <View style={{ marginTop: about.length ? 22 : 44, borderTopWidth: 0.5, borderTopColor: '#E8DDC455', paddingTop: 18 }}>
            <Text style={{ fontSize: 8, color: CREAM_ON_NAVY, letterSpacing: 1.2, textTransform: 'uppercase' }}>Indicative equity value {h.asAt}</Text>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 25, color: C.gold, marginTop: 7 }}>{h.equityRange}</Text>
            <Text style={{ fontSize: 9.5, color: CREAM_ON_NAVY, marginTop: 6 }}>
              Base case {h.midpoint}. Enterprise value {h.evRange}.
            </Text>
            <View style={{ marginTop: 10 }}>
              <PdfChart chart={equityRangeBar(r, 480, 46)} width={483} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 8, borderTopWidth: 0.5, borderTopColor: '#E8DDC433' }}>
              {kpis.map(([label, value], i) => (
                <View key={label} style={{ flex: 1, paddingTop: 9, paddingLeft: i ? 10 : 0, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: '#E8DDC433' }}>
                  <Text style={{ fontSize: 6.8, color: CREAM_ON_NAVY, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: C.white, marginTop: 4 }}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* The visitor's own words about the business, set apart as theirs. */}
          {about.length > 0 && (
            <View style={{ marginTop: 20, borderLeftWidth: 2, borderLeftColor: C.gold, paddingLeft: 12 }}>
              <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 1.2, textTransform: 'uppercase' }}>About the business</Text>
              {about.map((para, i) => (
                <Text key={i} style={{ fontSize: 9, lineHeight: 1.45, color: C.white, marginTop: i ? 4 : 5 }}>
                  {para}
                </Text>
              ))}
              <Text style={{ fontSize: 7, color: CREAM_ON_NAVY, marginTop: 4 }}>As described by {meta.preparedFor}. Not reviewed by PaceMakers.</Text>
            </View>
          )}
        </View>
        <View style={{ paddingHorizontal: 56, paddingBottom: 34 }}>
          <Text style={{ fontSize: 7.5, color: CREAM_ON_NAVY, lineHeight: 1.5 }}>
            Prepared for {meta.preparedFor}. {dataVersionLabel(meta.dataVersion)}. {TOOL_DISCLAIMER}
          </Text>
          <Text style={{ fontSize: 7, color: C.gold, marginTop: 6, letterSpacing: 0.4 }}>Powered by {PRODUCT_NAME}</Text>
        </View>
      </Page>

      {/* 2. Executive summary and financial profile */}
      <ContentPage title={REPORT_PAGE_TITLES[1]} meta={meta}>
        <View style={{ marginBottom: 10 }} wrap={false}>
          <Text style={s.eyebrow}>Indicative equity value, blended</Text>
          <Text style={[s.h1, { fontSize: 21, marginTop: 4 }]}>{h.equityRange}</Text>
          <Text style={{ fontSize: 9.5, marginTop: 4 }}>
            Base case <Text style={{ fontWeight: 600, color: C.goldMuted }}>{h.midpoint}</Text>, equity value {h.asAt}. {h.netDebtNote}
          </Text>
        </View>
        <View wrap={false} style={{ marginBottom: 6 }}>
          {executiveSummary(r).map((p, i) => (
            <Text key={i} style={{ fontSize: 9, lineHeight: 1.48, marginBottom: 5 }}>
              {p}
            </Text>
          ))}
        </View>
        <Section title="Financial profile" sub={`Revenue and EBITDA, three actual years then five forecast years, ${unit}. The line is the EBITDA margin.`} gap={8}>
          <PdfChart chart={revenueMarginChart(r, 760, 215)} width={W} />
          <View style={{ marginTop: 6 }}>
            <Tiles items={profileRatios(r)} columns={3} />
          </View>
        </Section>
        <View wrap={false}>
          <KeyValues
            labelWidth="28%"
            rows={[
              ['Prepared for', meta.preparedFor + (meta.company ? `, ${meta.company}` : '')],
              ...(purpose ? ([['Purpose', purpose]] as [string, string][]) : []),
              ['Methods', methodsUsed(r).join(', ')],
              ['Checks', warningCount ? `${warningCount} of ${checks.length} raise a warning (page 6)` : `All ${checks.length} passed (page 6)`],
            ]}
          />
        </View>
      </ContentPage>

      {/* 3. Valuation summary */}
      <ContentPage title={REPORT_PAGE_TITLES[2]} meta={meta}>
        <Section title="Value by method" sub={`Enterprise value, ${unit}. Each bar runs from low to high; the marker is the base case.`} gap={10}>
          <PdfChart chart={footballFieldChart(r)} width={W} />
          {notes.evRevenue && <Note>{notes.evRevenue}</Note>}
        </Section>
        <Section title="From enterprise value to equity" sub={`Base case, ${unit}. ${h.netDebtNote ?? ''}`} gap={10}>
          <PdfChart chart={waterfallChart(r, 760, 150)} width={W} />
          <View style={{ marginTop: 6 }}>
            <DataTable table={bridgeTable(r)} firstColWidth={52} />
          </View>
          {h.floorNote && (
            <Callout>
              <Text style={{ fontSize: 8.5 }}>{h.floorNote}</Text>
            </Callout>
          )}
        </Section>
        {purposeValue === 'raise' && (
          <Section title="Pre-money and post-money" gap={0}>
            {raise ? <DataTable table={raise} firstColWidth={52} /> : <Text style={{ fontSize: 9 }}>{PRE_MONEY_NOTE} No amount to raise was entered.</Text>}
          </Section>
        )}
      </ContentPage>

      {/* 4. Free cash flow, DCF and sensitivity */}
      <ContentPage title={REPORT_PAGE_TITLES[3]} meta={meta}>
        <Section title="Free cash flow to firm" sub={`Base case, ${unit}. Equity value ${h.asAt}.`} gap={10}>
          <DataTable table={fcfTable(r)} colWidths={[31, 11.5, 11.5, 11.5, 11.5, 11.5, 11.5]} />
          <Note>
            {terminalNote(r)} {taxNote(r)} {notes.financialYearEnd}
          </Note>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <View style={{ width: '58%', paddingRight: 12 }}>
              <KeyValues rows={dcfSummaryRows(r)} labelWidth="70%" />
            </View>
            <View style={{ width: '42%' }}>
              <Text style={{ fontSize: 8.5, color: C.muted, lineHeight: 1.45 }}>
                {notes.exitMultiple} The {LABELS.dcfCombined} is used in the blend; the low and high flex WACC by one point and growth by half a point, or the exit multiple by one turn.
              </Text>
            </View>
          </View>
        </Section>
        <Section title={sensitivityTitle(r)} sub="Rows are WACC, columns long-term growth. The outlined centre cell is the base case, at the unrounded WACC." gap={0}>
          <PdfChart chart={sensitivityHeatmap(r, 760, 215)} width={W} />
        </Section>
      </ContentPage>

      {/* 5. Scenarios and factors that could support a higher valuation */}
      <ContentPage title={REPORT_PAGE_TITLES[4]} meta={meta}>
        <Section title="Scenarios" sub={`Each scenario moves forecast revenue growth and EBITDA margin in every year, and is valued the same way. Base case values, ${unit}.`} gap={8}>
          {r.scenarios.length ? (
            <DataTable table={scenariosTable(r)} colWidths={[17, 12, 12, 13, 16, 15, 15]} />
          ) : (
            <Text style={{ fontSize: 9 }}>Scenarios were not computed for this version of the report.</Text>
          )}
          <Note>{notes.scenarios} Equity is shown before any floor at zero, so the weighted row reconciles.</Note>
          {r.stake.used ? (
            <View style={{ marginTop: 6 }}>
              <KeyValues
                rows={[
                  ['Stake', stakeLabel(r)],
                  ['Equity value, 100%', h.equityRange],
                  ['Indicative value of the stake', h.stakeRange ?? ''],
                ]}
              />
            </View>
          ) : (
            <Note>The valuation is for 100% of the equity, with no control premium or minority discount applied.</Note>
          )}
        </Section>
        <View style={s.rule} />
        <Text style={s.h2}>{LABELS.factors}</Text>
        <Text style={s.sub}>Chosen by rule from these results, most material first. None of them is a promise of a higher value.</Text>
        {valueLevers(r).map((l, i) => (
          <View key={l.title} wrap={false} style={{ flexDirection: 'row', marginBottom: 9 }}>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 15, color: C.gold, width: 24 }}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 600 }}>{l.title}</Text>
              <Text style={{ fontSize: 9, lineHeight: 1.45, color: C.muted, marginTop: 2 }}>{l.detail}</Text>
            </View>
          </View>
        ))}
      </ContentPage>

      {/* 6 and 7. Checks and key assumptions, then methodology, sources and
          disclaimer. One flowing section over two pages: each block is kept
          whole, and a long check list or a long list of comparable companies
          moves the methodology down rather than adding a page. */}
      <ContentPage title={REPORT_PAGE_TITLES[5]} meta={meta}>
        <View wrap={false} style={{ marginBottom: 6 }}>
          <View style={s.rule} />
          <Text style={s.h2}>Checks, all run on every valuation</Text>
          <View style={{ borderTopWidth: 0.5, borderTopColor: C.border }}>
            {checks.map((x) => (
              <View key={x.id} style={{ flexDirection: 'row', paddingVertical: 1.8, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
                <Text style={{ width: '11%', fontSize: 7.5, fontWeight: 600, color: x.status === 'pass' ? C.green : C.red }}>{x.status === 'pass' ? 'PASS' : 'WARNING'}</Text>
                <Text style={{ width: '22%', fontSize: 8, fontWeight: 600, paddingRight: 4 }}>{x.label}</Text>
                <Text style={{ width: '67%', fontSize: 8, color: C.muted, lineHeight: 1.35 }}>{x.message}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row' }} wrap={false}>
          <View style={{ width: '50%', paddingRight: 10 }}>
            <SubHead>Cost of capital</SubHead>
            <KeyValues rows={waccBuildRows(r)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.navy, paddingVertical: 4, paddingHorizontal: 6, marginTop: 4 }}>
              <Text style={{ color: CREAM_ON_NAVY, fontSize: 8.5 }}>WACC, {c.code}</Text>
              <Text style={{ color: C.gold, fontWeight: 600, fontSize: 8.5 }}>{h.wacc}</Text>
            </View>
          </View>
          <View style={{ width: '50%', paddingLeft: 10 }}>
            <SubHead>Terminal value</SubHead>
            <KeyValues rows={terminalRows(r)} labelWidth="66%" />
            <SubHead>Comparables</SubHead>
            <KeyValues rows={comparablesRows(r).filter(([k]) => !k.startsWith('Companies'))} labelWidth="52%" />
          </View>
        </View>
        {r.comparables.peerNames.length > 0 && (
          <Text style={{ fontSize: 8, color: C.muted, marginTop: 4, lineHeight: 1.4 }} wrap={false}>
            <Text style={{ fontWeight: 600, color: C.text }}>Selected comparable companies ({r.comparables.peerNames.length}): </Text>
            {r.comparables.peerNames.join('; ')}.
          </Text>
        )}
        {/* Allowed to break: with a zakat base and a rolled-forward net debt this block is long, and moving it whole would push the sources onto a third page. */}
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <View style={{ width: '50%', paddingRight: 10 }}>
            <SubHead>{r.tax.zakatApplies ? 'Tax and zakat' : 'Tax'}</SubHead>
            <KeyValues rows={taxRows(r)} labelWidth="50%" />
            {notes.premiumAndDiscount && <Note>{notes.premiumAndDiscount}</Note>}
          </View>
          <View style={{ width: '50%', paddingLeft: 10 }}>
            <SubHead>Balance sheet, EBITDA and timing</SubHead>
            <KeyValues
              labelWidth="50%"
              rows={[
                ...timingRows(r),
                ...(bridgeItemsUsed
                  ? ([
                      ['End of service benefits', amt(b.eosb)],
                      ['Lease liabilities', amt(b.leases)],
                      ['Minority interest', amt(b.minorityInterest)],
                      ['Surplus assets', amt(b.surplusAssets)],
                    ] as [string, string][])
                  : ([['Other claims, surplus assets', 'None entered']] as [string, string][])),
                r.normalisation.used
                  ? ['Normalised EBITDA', `${fmtAmount(r.ltmEbitdaReported, u)} to ${amt(r.ltmEbitda)}`]
                  : ['EBITDA', 'Reported, no adjustments'],
              ]}
            />
          </View>
        </View>

        <View wrap={false} style={{ marginBottom: 8 }}>
          {[notes.zakat, notes.valuationDate, notes.financialYearEnd].filter(Boolean).map((line) => (
            <Text key={line as string} style={{ fontSize: 8.5, color: C.muted, lineHeight: 1.4, marginTop: 2 }}>
              {line}
            </Text>
          ))}
        </View>

        <View minPresenceAhead={160} style={{ marginTop: 6 }}>
          <Text style={s.pageTitle}>{REPORT_PAGE_TITLES[6]}</Text>
        </View>
        <Section title="How the value was built" gap={10}>
          <Text style={{ fontSize: 9, lineHeight: 1.45, marginBottom: 4 }}>
            The DCF discounts five years of free cash flow to the firm at the WACC from the valuation date, counting only the part of the first
            forecast year after it. The terminal value is taken two ways, growth in perpetuity on a cash flow whose reinvestment is sized for
            long-term growth, and an exit multiple of final year EBITDA, and the DCF in the blend is their average.
          </Text>
          <Text style={{ fontSize: 9, lineHeight: 1.45, marginBottom: 4 }}>
            Comparables apply EV / EBITDA, or EV / Revenue where EBITDA is not positive, to the last actual year, after any private company
            discount. The two methods are blended at the weight chosen, and net debt and the other balance sheet items are deducted to reach equity.
          </Text>
          <Text style={{ fontSize: 9, lineHeight: 1.45 }}>
            The WACC combines a cost of equity (risk-free rate, mature market premium, country premium, relevered industry beta and size premium)
            with an after-tax cost of debt. Tax is charged on positive EBIT with losses carried forward; in Saudi Arabia zakat applies to the
            Saudi / GCC owned share.{c.pegged ? '' : ` For ${c.code}, the US dollar WACC is converted using the expected inflation gap.`}
          </Text>
        </Section>
        <View minPresenceAhead={80}>
          <View style={s.rule} />
          <Text style={s.h2}>Sources</Text>
        </View>
        {SOURCE_NOTES.map((note) => (
          <Text key={note.label} wrap={false} style={{ fontSize: 8.5, color: C.muted, lineHeight: 1.4, marginBottom: 3 }}>
            <Text style={{ fontWeight: 600, color: C.text }}>{note.label}. </Text>
            {note.source}
            {/ as at$/.test(note.source) ? ' ' : ', '}
            {note.asOf}.
          </Text>
        ))}
        <View style={{ marginTop: 10 }} wrap={false}>
          <View style={s.rule} />
          <Text style={s.h2}>Important</Text>
          <Text style={[s.note, { fontSize: 8.5, marginTop: 2 }]}>{INDICATIVE_NOTE}</Text>
          <Text style={[s.note, { fontSize: 8.5, marginTop: 3 }]}>{RELIANCE_STATEMENT}</Text>
          <Text style={[s.note, { fontSize: 8.5, marginTop: 3 }]}>{TOOL_DISCLAIMER}</Text>
        </View>
      </ContentPage>

      {/* 8. Working with PaceMakers */}
      <ContentPage title={REPORT_PAGE_TITLES[7]} meta={meta}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }} wrap={false}>
          <Text style={[s.body, { flex: 1, paddingRight: 16 }]}>
            PaceMakers is a corporate finance and transaction advisory firm serving family offices, investment offices and corporates across Saudi
            Arabia, the GCC and worldwide. Every mandate is partner-led.
          </Text>
          {brand?.logoOnLight && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={{ data: brand.logoOnLight, format: 'png' }} style={{ height: 26, width: 26 * LOGO_RATIO }} />
          )}
        </View>

        {partner && (
          <View style={{ borderWidth: 0.75, borderColor: C.border, padding: 14, marginBottom: 14, flexDirection: 'row' }} wrap={false}>
            {brand?.partnerPhoto && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={{ data: brand.partnerPhoto, format: 'jpg' }} style={{ width: 76, height: 95, marginRight: 14, objectFit: 'cover' }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>Who you will work with</Text>
              <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 14, marginTop: 3 }}>{partner.name}</Text>
              <Text style={{ fontSize: 8.5, color: C.text, marginTop: 1 }}>{[partner.role, partner.title].filter(Boolean).join(', ')}</Text>
              {partner.credentialsLine ? <Text style={{ fontSize: 8.5, color: C.goldMuted, fontWeight: 600, marginTop: 3 }}>{partner.credentialsLine}</Text> : null}
              {partner.intro ? <Text style={{ fontSize: 8.5, color: C.text, lineHeight: 1.5, marginTop: 6 }}>{partner.intro}</Text> : null}
              {partner.highlights.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  {partner.highlights.map((hl) => (
                    <View key={hl} style={{ flexDirection: 'row', marginTop: 2 }}>
                      <View style={{ width: 3.5, height: 3.5, backgroundColor: C.gold, marginTop: 3.6, marginRight: 5.5 }} />
                      <Text style={{ fontSize: 8.5, color: C.text, flex: 1, lineHeight: 1.4 }}>{hl}</Text>
                    </View>
                  ))}
                  <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 3 }}>{PARTNER_RECORD_NOTE}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Text style={[s.eyebrow, { marginBottom: 6 }]}>Services</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }} wrap={false}>
          {SERVICES.map((svc) => (
            <View key={svc.slug} style={{ width: partner ? '33.33%' : '50%', paddingRight: 10, marginBottom: partner ? 5 : 9 }}>
              <Text style={{ fontSize: partner ? 8.5 : 9.5, fontWeight: 600 }}>
                <Text style={{ color: C.goldMuted }}>{svc.number}  </Text>
                {svc.title}
              </Text>
              {!partner && <Text style={{ fontSize: 8.5, color: C.muted, lineHeight: 1.4, marginTop: 1 }}>{svc.summary}</Text>}
            </View>
          ))}
        </View>
        <View style={{ backgroundColor: C.navy, padding: 18, flexDirection: 'row', alignItems: 'center' }} wrap={false}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 15, color: C.white }}>
              Get a valuation you can defend
            </Text>
            {/* A unitless line height needs the font size set on the same element: react-pdf resolves it against its 18pt default otherwise. */}
            <Text style={{ color: CREAM_ON_NAVY, marginTop: 5, fontSize: 10.5, lineHeight: 1.5 }}>
              Book a free 30 minute call to review your model, your assumptions and what an independent valuation would cover.
            </Text>
            <Link src={meta.bookingHref} style={{ marginTop: 10, textDecoration: 'none' }}>
              <View style={{ backgroundColor: C.gold, paddingVertical: 7, paddingHorizontal: 14, alignSelf: 'flex-start' }}>
                <Text style={{ color: C.deep, fontWeight: 600, fontSize: 9, letterSpacing: 1 }}>BOOK A FREE CALL</Text>
              </View>
            </Link>
          </View>
          <View style={{ alignItems: 'center' }}>
            <QrCode text={meta.bookingHref} size={92} />
            <Text style={{ fontSize: 7.5, color: CREAM_ON_NAVY, marginTop: 4 }}>Scan to book</Text>
          </View>
        </View>
        <Text style={[s.note, { marginTop: 12, fontSize: 8.5 }]}>advisory@pacemakersglobal.com  |  www.pacemakersglobal.com</Text>
      </ContentPage>
    </Document>
  );
}

/**
 * Renders the report to a PDF buffer, after checking the result reconciles.
 * A result without the version 3 blocks cannot fill the pages and is refused;
 * stored leads pass through `resultForReport` first, which supplies them.
 */
export async function renderValuationReport(result: ValuationResult, meta: ReportMeta): Promise<Buffer> {
  if (!isCanonicalResult(result)) throw new Error('This result predates the current report. Build it with resultForReport.');
  assertReconciled(result);
  registerFonts();
  return renderToBuffer(<ValuationReport result={result} meta={meta} />);
}

/** A tidy attachment name: "PaceMakers valuation Acme 2026-09-16.pdf" without awkward characters. */
export function reportFileName(company: string | null, preparedFor: string, date: Date): string {
  const who = (company || preparedFor).replace(/[^A-Za-z0-9 ]+/g, '').trim().slice(0, 60) || 'report';
  return `PaceMakers valuation ${who} ${date.toISOString().slice(0, 10)}.pdf`;
}
