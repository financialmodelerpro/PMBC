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
 * THEME. Colours, type, the letterhead cover and closing page, the inner page
 * frame and footer, tables, tiles and the booking panel come from the shared
 * report theme (`theme.ts`, `components.tsx`), which every tool report uses.
 * This file supplies the content and the report details only.
 *
 * BRAND MATERIAL (`meta.branding`, from `src/lib/tools/brand/fetch.ts`): the
 * colour and white logos from Header Settings, the brand name and tagline, the
 * contact details from Site Settings, and the partner card from the founder
 * profile. Every piece is optional.
 * A section with nothing to report says so rather than disappearing, so the
 * page order never depends on the inputs. Blocks are kept whole
 * (`wrap={false}`) and each page is sized to hold its longest case, which
 * `verify-tool-email-pdf` checks by counting pages.
 */

import { Document, Text, View, renderToBuffer } from '@react-pdf/renderer';

import { SERVICES } from '@/config/services';
import { findTool } from '@/config/tools';

import { PURPOSES, SOURCE_NOTES, dataVersionLabel } from '../valuation/data';
import { descriptionParagraphs } from '../valuation/profile';
import { isCanonicalResult, type ValuationResult } from '../valuation/engine';
import { equityRangeBar, footballFieldChart, revenueMarginChart, sensitivityHeatmap, waterfallChart } from '../valuation/charts';
import {
  INDICATIVE_NOTE,
  LABELS,
  dcfCombinedLabel,
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
  fmtPct,
  fmtWacc,
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
  waccSteps,
  type Table,
} from '../valuation/format';
import { assertReconciled } from '../valuation/reconcile';
import { PdfChart } from './PdfChart';
import {
  BookingPanel,
  Callout,
  ClosingPage,
  DataTable,
  Eyebrow,
  KeyValues,
  KpiRow,
  Note,
  PageTitle,
  PairedColumns,
  PartnerBlock,
  ReportCover,
  ReportPage,
  Section,
  SectionHeading,
  ServicesGrid,
  SubHead,
  Tiles,
} from './components';
import { NO_LIGATURES, PAGE, RC, REPORT_CHART_PALETTE as P, registerFonts, s, withBrandDefaults, type ReportBranding, type ReportDetails } from './theme';

export type { ReportBranding } from './theme';

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
  /**
   * Logos, the partner card and contact details. Left out, the report fetches
   * them itself (`fetchReportBranding`), so a render never silently drops the
   * founder block or the logo. `null` means render without any.
   */
  branding?: ReportBranding | null;
  /** The visitor's own description of the business, already cleaned. Shown on the cover. */
  description?: string | null;
};

/** The tool's name from the registry, as the report footer prints it. */
export const TOOL_NAME = findTool('business-valuation')?.name ?? 'Business Valuation';

/** The product name the site already uses for the tool. */
export const PRODUCT_NAME = `PaceMakers ${TOOL_NAME}`;

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
  const brand = withBrandDefaults(meta.branding);
  const partner = brand.partner;
  const about = descriptionParagraphs(meta.description);
  const checks = checkItems(r);
  const warningCount = checks.filter((x) => x.status === 'warning').length;
  const perpetuityOnly = r.dcfBlock?.combination === 'perpetuity_only';
  // The WACC working for page 5, with the two weights on one line: the page holds five value factors
  // and a stake table above it, and one line fewer is what keeps that case on eight pages.
  const pdfWaccSteps = waccSteps(r.wacc, c).flatMap((x) =>
    x.key === 'we'
      ? []
      : x.key === 'wd'
        ? [{ ...x, label: 'Debt and equity weights', named: `debt D/E ${fmtPct(r.wacc.de, 1)} / (1 + D/E); equity 1 - debt`, value: `${fmtPct(r.wacc.wd, 1)} / ${fmtPct(r.wacc.we, 1)}` }]
        : [x],
  );
  const notes = disclosures(r);
  const raise = raiseTable(r);
  const details: ReportDetails = { toolName: TOOL_NAME, subject: who, dateLabel: r.meta.valuationDate ? h.valuationDate : dateText };
  const kpis: [string, string][] = [
    [LABELS.wacc, h.wacc],
    [LABELS.tvShare, h.tvShare],
    [LABELS.ltmMultiple, h.ltmMultiple],
    [LABELS.weighted, h.weighted ?? 'n/a'],
  ];
  // Long company names step down so the cover never runs onto a second page.
  const titleSize = who.length > 80 ? 20 : who.length > 44 ? 25 : 30;

  return (
    <Document title={`Indicative valuation, ${who}`} author={brand.brandName} subject="Indicative business valuation">
      {/* 1. Valuation at a glance: the letterhead cover */}
      <ReportCover brand={brand} details={details}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{REPORT_PAGE_TITLES[0]}</Eyebrow>
          <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: titleSize, lineHeight: 1.1, color: RC.navy, marginTop: 10 }}>{who}</Text>
          <Text style={{ fontSize: 10, color: RC.muted, marginTop: 8 }}>
            {meta.industry}, {meta.country}. Prepared {dateText}.
          </Text>

          <View style={{ marginTop: about.length ? 22 : 40, borderTopWidth: 0.5, borderTopColor: RC.border, paddingTop: 18 }}>
            <Text style={{ fontSize: 8, color: RC.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Indicative equity value {h.asAt}</Text>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 25, color: RC.navy, marginTop: 7 }}>{h.equityRange}</Text>
            <Text style={{ fontSize: 9.5, color: RC.text, marginTop: 6 }}>
              Base case {h.midpoint}. Enterprise value {h.evRange}.
            </Text>
            <View style={{ marginTop: 10 }}>
              <PdfChart chart={equityRangeBar(r, 480, 46, P)} width={483} />
            </View>
            <View style={{ marginTop: 8 }}>
              <KpiRow items={kpis} />
            </View>
          </View>

          {/* The visitor's own words about the business, set apart as theirs. */}
          {about.length > 0 && (
            <View style={{ marginTop: 20, borderLeftWidth: 2, borderLeftColor: RC.green, paddingLeft: 12 }}>
              <Eyebrow>About the business</Eyebrow>
              {about.map((para, i) => (
                <Text key={i} style={{ fontSize: 9, lineHeight: 1.45, color: RC.text, marginTop: i ? 4 : 5 }}>
                  {para}
                </Text>
              ))}
              <Text style={{ fontSize: 7, color: RC.muted, marginTop: 4 }}>As described by {meta.preparedFor}. Not reviewed by PaceMakers.</Text>
            </View>
          )}
        </View>
        <View>
          <Text style={{ fontSize: 7.5, color: RC.muted, lineHeight: 1.5 }}>
            Prepared for {meta.preparedFor}. {dataVersionLabel(r.meta.dataVersion || meta.dataVersion)}. {TOOL_DISCLAIMER}
          </Text>
          <Text style={{ fontSize: 7, color: RC.navy, fontWeight: 600, marginTop: 5, letterSpacing: 0.4 }}>Powered by {PRODUCT_NAME}</Text>
        </View>
      </ReportCover>

      {/* 2. Executive summary and financial profile */}
      <ReportPage title={REPORT_PAGE_TITLES[1]} brand={brand} details={details}>
        <View style={{ marginBottom: 10 }} wrap={false}>
          <Eyebrow>Indicative equity value, blended</Eyebrow>
          <Text style={[s.h1, { fontSize: 21, marginTop: 4 }]}>{h.equityRange}</Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.45, marginTop: 4 }}>
            Base case <Text style={{ fontWeight: 600, color: RC.navy }}>{h.midpoint}</Text>, equity value {h.asAt}. {h.netDebtNote}
          </Text>
        </View>
        <View wrap={false} style={{ marginBottom: 6 }}>
          {executiveSummary(r).map((p, i) => (
            <Text key={i} style={{ fontSize: 9, lineHeight: 1.48, marginBottom: 5 }}>
              {p}
            </Text>
          ))}
        </View>
        <Section title="Financial profile" sub={`Revenue and EBITDA, three actual years in navy then five forecast years in green, ${unit}. The line is the EBITDA margin.`} gap={8}>
          <PdfChart chart={revenueMarginChart(r, 760, 215, P)} width={W} />
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
      </ReportPage>

      {/* 3. Valuation summary */}
      <ReportPage title={REPORT_PAGE_TITLES[2]} brand={brand} details={details}>
        <Section title="Value by method" sub={`Enterprise value, ${unit}. Each bar runs from low to high; the marker is the base case.`} gap={10}>
          <PdfChart chart={footballFieldChart(r, 760, P)} width={W} />
          {notes.evRevenue && <Note>{notes.evRevenue}</Note>}
        </Section>
        <Section title="From enterprise value to equity" sub={`Base case, ${unit}. ${h.netDebtNote ?? ''}`} gap={10}>
          <PdfChart chart={waterfallChart(r, 760, 128, P)} width={W} />
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
      </ReportPage>

      {/* 4. Free cash flow, DCF and sensitivity */}
      <ReportPage title={REPORT_PAGE_TITLES[3]} brand={brand} details={details}>
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
              <Text style={{ fontSize: 8.5, color: RC.muted, lineHeight: 1.45 }}>
                {notes.exitMultiple} The {dcfCombinedLabel(r)} is used in the blend; the low and high flex WACC by one point and growth by half a point, or the exit multiple by one turn.
              </Text>
            </View>
          </View>
        </Section>
        <Section title={sensitivityTitle(r)} sub="Rows are WACC, columns long-term growth. The outlined centre cell is the base case, at the unrounded WACC." gap={0}>
          <PdfChart chart={sensitivityHeatmap(r, 760, 215, P)} width={W} />
        </Section>
      </ReportPage>

      {/* 5. Scenarios and factors that could support a higher valuation */}
      <ReportPage title={REPORT_PAGE_TITLES[4]} brand={brand} details={details}>
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
                  ['Equity value, 100%', h.table.equityRange],
                  ['Indicative value of the stake', h.table.stakeRange ?? ''],
                ]}
              />
            </View>
          ) : (
            <Note>The valuation is for 100% of the equity, with no control premium or minority discount applied.</Note>
          )}
        </Section>
        <SectionHeading title={LABELS.factors} sub="Chosen by rule from these results, most material first. None of them is a promise of a higher value." />
        {valueLevers(r).map((l, i) => (
          <View key={l.title} wrap={false} style={{ flexDirection: 'row', marginBottom: 9 }}>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 15, color: RC.green, width: 24 }}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 600, color: RC.navy }}>{l.title}</Text>
              <Text style={{ fontSize: 9, lineHeight: 1.45, color: RC.muted, marginTop: 2 }}>{l.detail}</Text>
            </View>
          </View>
        ))}
        {/* The WACC worked through, from the same steps as the form and the results page. One line
            each, with every figure named, so it fits below the factors (at most five) on this page. */}
        <SectionHeading
          title="Cost of capital"
          sub={
            c.pegged
              ? 'How the WACC used to discount the forecast is calculated.'
              : `The Damodaran inputs are US dollar rates, so the WACC is built in US dollars and the last line converts it to ${c.code}.`
          }
        />
        <View wrap={false}>
          {pdfWaccSteps.map((x) => (
            <View key={x.key} style={{ flexDirection: 'row', paddingVertical: 1.8, borderBottomWidth: 0.5, borderBottomColor: RC.border }}>
              <Text style={{ width: '30%', fontSize: 8.5, fontWeight: x.strong ? 600 : 400, color: x.strong ? RC.navy : RC.text, paddingRight: 4 }}>{x.label}</Text>
              <Text style={{ width: '55%', fontSize: 8, color: RC.muted, paddingRight: 4 }}>{x.named}</Text>
              <Text style={{ width: '15%', fontSize: 8.5, textAlign: 'right', fontWeight: x.strong ? 600 : 400, color: x.strong ? RC.navy : RC.text }}>{x.value}</Text>
            </View>
          ))}
        </View>
      </ReportPage>

      {/* 6 and 7. Checks and key assumptions, then methodology, sources and
          disclaimer. One flowing section over two pages: each block is kept
          whole, and a long check list or a long list of comparable companies
          moves the methodology down rather than adding a page. */}
      <ReportPage title={REPORT_PAGE_TITLES[5]} brand={brand} details={details}>
        <View wrap={false} style={{ marginBottom: 6 }}>
          <SectionHeading title="Checks, all run on every valuation" />
          <View style={{ borderTopWidth: 0.5, borderTopColor: RC.border }}>
            {checks.map((x) => (
              <View key={x.id} style={{ flexDirection: 'row', paddingVertical: 1.8, borderBottomWidth: 0.5, borderBottomColor: RC.border }}>
                <Text style={{ width: '11%', fontSize: 7.5, fontWeight: 600, color: x.status === 'pass' ? RC.green : RC.warning }}>{x.status === 'pass' ? 'PASS' : 'WARNING'}</Text>
                <Text style={{ width: '24%', fontSize: 8, fontWeight: 600, paddingRight: 4 }}>{x.label}</Text>
                <Text style={{ width: '65%', fontSize: 8, color: RC.muted, lineHeight: 1.3 }}>{x.message}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 4 }} wrap={false}>
          <View style={{ width: '50%', paddingRight: 10 }}>
            <SubHead>Terminal value</SubHead>
            <KeyValues rows={terminalRows(r)} labelWidth="72%" />
          </View>
          <View style={{ width: '50%', paddingLeft: 10 }}>
            <SubHead>Comparables</SubHead>
            {/* Page 6 is the tightest page: EV / EBIT is on page 3's value by method instead. */}
            <KeyValues rows={comparablesRows(r).filter(([k]) => !k.startsWith('Companies') && k !== 'After discount, EV / EBIT (reference)')} labelWidth="52%" />
          </View>
        </View>
        {r.comparables.peerNames.length > 0 && (
          <Text style={{ fontSize: 8, color: RC.muted, marginTop: 4, lineHeight: 1.4 }} wrap={false}>
            <Text style={{ fontWeight: 600, color: RC.text }}>Selected comparable companies ({r.comparables.peerNames.length}): </Text>
            {r.comparables.peerNames.join('; ')}.
          </Text>
        )}
        {/* Row by row, so it can break across the page rather than moving whole. */}
        <View style={{ marginBottom: 10 }}>
          <PairedColumns
            // Wide label columns: a wrapped label costs a line on the tightest page.
            leftLabelWidth="55%"
            rightLabelWidth="64%"
            left={{ title: r.tax.zakatApplies ? 'Tax and zakat' : 'Tax', rows: taxRows(r), note: notes.premiumAndDiscount }}
            right={{
              title: 'Balance sheet, EBITDA and timing',
              rows: [
                ...timingRows(r),
                // Only when entered: it drives the returns checks, so the report states the figure they used.
                ...(r.investedCapital ? ([['Invested capital', amt(r.investedCapital.total)]] as [string, string][]) : []),
                ...(bridgeItemsUsed
                  ? ([
                      ['End of service benefits', amt(b.eosb)],
                      ['Lease liabilities', amt(b.leases)],
                      ['Minority interest', amt(b.minorityInterest)],
                      ['Surplus assets', amt(b.surplusAssets)],
                    ] as [string, string][])
                  : ([['Other claims, surplus assets', 'None entered']] as [string, string][])),
                // Two rows, each with its unit, rather than "1,720.0 to 1,845.0 PKR m" in one cell, which
                // wrapped the unit onto a line of its own in the narrow value column.
                ...(r.normalisation.used
                  ? ([
                      ['EBITDA, reported', amt(r.ltmEbitdaReported)],
                      ['EBITDA, normalised', amt(r.ltmEbitda)],
                    ] as [string, string][])
                  : ([['EBITDA', 'Reported, no adjustments']] as [string, string][])),
              ],
            }}
          />
        </View>

        <View wrap={false} style={{ marginBottom: 4 }}>
          {[notes.zakat, notes.valuationDate, notes.financialYearEnd].filter(Boolean).map((line) => (
            <Text key={line as string} style={{ fontSize: 8.5, color: RC.muted, lineHeight: 1.4, marginTop: 2 }}>
              {line}
            </Text>
          ))}
        </View>

        <View minPresenceAhead={160} style={{ marginTop: 2 }}>
          <PageTitle>{REPORT_PAGE_TITLES[6]}</PageTitle>
        </View>
        <Section title="How the value was built" gap={8}>
          <Text style={{ fontSize: 9, lineHeight: 1.45, marginBottom: 4 }}>
            The DCF discounts five years of free cash flow to the firm at the WACC from the valuation date, counting only the part of the first
            forecast year after it. The terminal value is taken two ways, growth in perpetuity on a cash flow whose reinvestment is sized for
            long-term growth, and an exit multiple of final year EBITDA, and the DCF in the blend is {perpetuityOnly ? 'the perpetuity figure alone, since final year EBITDA does not support an exit multiple' : 'their average'}.
          </Text>
          <Text style={{ fontSize: 9, lineHeight: 1.45 }}>
            Comparables apply EV / EBITDA, or EV / Revenue where EBITDA is not positive, to the last actual year, after any private company
            discount; the two methods are blended at the weight chosen and net debt and other claims are deducted to reach equity. The WACC
            combines a cost of equity (risk-free rate, mature market, country and size premiums, relevered industry beta) with an after-tax cost
            of debt.{c.pegged ? '' : ` For ${c.code}, the US dollar WACC is converted using the expected inflation gap.`}
          </Text>
        </Section>
        <View minPresenceAhead={80}>
          <SectionHeading title="Sources" />
        </View>
        {SOURCE_NOTES.map((note) => (
          <Text key={note.label} wrap={false} style={{ fontSize: 8.5, color: RC.muted, lineHeight: 1.4, marginBottom: 3 }}>
            <Text style={{ fontWeight: 600, color: RC.text }}>{note.label}. </Text>
            {note.source}
            {/ as at$/.test(note.source) ? ' ' : ', '}
            {note.asOf}.
          </Text>
        ))}
        <View style={{ marginTop: 10 }} wrap={false}>
          <SectionHeading title="Important" />
          <Text style={[s.note, { fontSize: 8.5, marginTop: 2 }]}>{INDICATIVE_NOTE}</Text>
          <Text style={[s.note, { fontSize: 8.5, marginTop: 3 }]}>{RELIANCE_STATEMENT}</Text>
          <Text style={[s.note, { fontSize: 8.5, marginTop: 3 }]}>{TOOL_DISCLAIMER}</Text>
        </View>
      </ReportPage>

      {/* 8. Working with PaceMakers, in the letterhead style */}
      <ClosingPage title={REPORT_PAGE_TITLES[7]} brand={brand} details={details}>
        <Text style={[s.body, { marginBottom: 12 }]}>
          PaceMakers is a corporate finance and transaction advisory firm serving family offices, investment offices and corporates across Saudi
          Arabia, the GCC and worldwide. Every mandate is partner-led.
        </Text>
        {partner && <PartnerBlock partner={partner} photo={brand.partnerPhoto} />}
        <ServicesGrid services={SERVICES} compact={Boolean(partner)} />
        <BookingPanel
          href={meta.bookingHref}
          heading="Get a valuation you can defend"
          text="Book a free 30 minute call to review your model, your assumptions and what an independent valuation would cover."
        />
      </ClosingPage>
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
  const branding = meta.branding !== undefined ? meta.branding : await import('../brand/fetch').then((m) => m.fetchReportBranding()).catch(() => null);
  return renderToBuffer(<ValuationReport result={result} meta={{ ...meta, branding }} />);
}

/** A tidy attachment name: "PaceMakers valuation Acme 2026-09-16.pdf" without awkward characters. */
export function reportFileName(company: string | null, preparedFor: string, date: Date): string {
  const who = (company || preparedFor).replace(/[^A-Za-z0-9 ]+/g, '').trim().slice(0, 60) || 'report';
  return `PaceMakers valuation ${who} ${date.toISOString().slice(0, 10)}.pdf`;
}
