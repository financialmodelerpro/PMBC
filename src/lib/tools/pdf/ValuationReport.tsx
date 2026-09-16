/**
 * The branded PDF valuation report, rendered on the server with @react-pdf/renderer.
 *
 * TEN A4 PAGES, ALWAYS, whatever the visitor used:
 *   1  Cover
 *   2  Executive summary
 *   3  Valuation summary and value bridge
 *   4  Financial profile: revenue and margin, cash conversion, key ratios
 *   5  Free cash flow and sensitivity heatmap
 *   6  Scenarios, stake and checks
 *   7  What would increase your value
 *   8  Assumptions
 *   9  Methodology and sources
 *   10 Working with PaceMakers: the partner, the services, the booking link and a QR code
 *
 * BRAND MATERIAL (`meta.branding`, from `src/lib/tools/brand/fetch.ts`): the
 * logo from Header Settings on the cover and the closing page, and the partner
 * card from the founder profile on the closing page. Every piece is optional.
 * Without a logo the cover sets the name in type; without a partner card the
 * block is left out and the services list takes the room.
 * A section with nothing to report says so rather than disappearing, so the page
 * count and the page order never depend on the inputs. Each block is kept whole
 * (`wrap={false}`) and each page is sized to hold its longest case.
 *
 * Everything it says comes from `format.ts`, and every chart from `charts.ts`,
 * the same modules the results dashboard uses. Nothing here computes a value.
 */

import type { ReactNode } from 'react';
import { Document, Image, Link, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';

import { SERVICES } from '@/config/services';

import { PARTNER_RECORD_NOTE, type PartnerCard } from '../brand/partner';

import { PURPOSES, SOURCE_NOTES, dataVersionLabel } from '../valuation/data';
import { descriptionParagraphs } from '../valuation/profile';
import type { ValuationResult } from '../valuation/engine';
import {
  cashConversionChart,
  footballFieldChart,
  revenueMarginChart,
  sensitivityHeatmap,
  waterfallChart,
} from '../valuation/charts';
import {
  INDICATIVE_NOTE,
  TAX_NOTE,
  TOOL_DISCLAIMER,
  bridgeTable,
  currencyMillions,
  executiveSummary,
  fcfTable,
  fmtMillions,
  headline,
  keyRatiosTable,
  methodsUsed,
  normalisationRows,
  scenariosTable,
  stakeLabel,
  terminalRows,
  valueLevers,
  waccBuildRows,
  warningTexts,
  type Table,
} from '../valuation/format';
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
  /** The visitor's own description of the business, already cleaned. Shown on the executive summary. */
  description?: string | null;
};

export type ReportBranding = {
  /** The logo for the navy cover, already resized. PNG. */
  logoOnDark: Buffer | null;
  /** The logo for white pages. PNG. */
  logoOnLight: Buffer | null;
  partner: PartnerCard | null;
  /** The partner portrait, resized to 360 by 450. JPEG. */
  partnerPhoto: Buffer | null;
};

/** Logo files are trimmed and about 5.2 to 1. Height is set, width follows. */
const LOGO_RATIO = 6113 / 1176;

export const REPORT_PAGE_TITLES = [
  'Indicative business valuation',
  'Executive summary',
  'Valuation summary',
  'Financial profile',
  'Free cash flow and sensitivity',
  'Scenarios, stake and checks',
  'What would increase your value',
  'Assumptions',
  'Methodology and sources',
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

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <View style={s.section} wrap={false}>
      <View style={s.rule} />
      <Text style={s.h2}>{title}</Text>
      {sub && <Text style={s.sub}>{sub}</Text>}
      {children}
    </View>
  );
}

function DataTable({ table, axis, firstColWidth = 34, colWidths }: { table: Table; axis?: boolean; firstColWidth?: number; colWidths?: number[] }) {
  const cols = table.head.length - 1;
  const widths = colWidths ?? [firstColWidth, ...new Array<number>(cols).fill((100 - firstColWidth) / cols)];
  const cell = (i: number, align: 'left' | 'right') => ({ width: `${widths[i]}%`, paddingVertical: 3.2, paddingHorizontal: 5, textAlign: align });
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
            <Text style={[cell(0, 'left'), { fontWeight: strong || axis ? 600 : 400, color: muted || axis ? C.muted : C.text }]}>{row.label}</Text>
            {row.values.map((v, ci) => (
              <Text key={ci} style={[cell(ci + 1, 'right'), { fontWeight: strong ? 600 : 400, color: muted ? C.muted : C.text }]}>
                {v}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function KeyValues({ rows, compact }: { rows: [string, string][]; compact?: boolean }) {
  return (
    <View>
      {rows.map(([k, v], i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: compact ? 2.2 : 3, borderBottomWidth: 0.5, borderBottomColor: C.border }}
        >
          <Text style={{ color: C.muted, fontSize: compact ? 8.5 : 9.5, width: '56%' }}>{k}</Text>
          <Text style={{ fontWeight: 500, fontSize: compact ? 8.5 : 9.5, width: '44%', textAlign: 'right' }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Tiles({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: C.border }}>
      {items.map(([k, v], i) => (
        <View key={k} style={{ flex: 1, padding: 8, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: C.border }}>
          <Text style={{ fontSize: 7.5, color: C.muted }}>{k}</Text>
          <Text style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Callout({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'red' }) {
  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: tone === 'gold' ? C.gold : C.red, backgroundColor: C.cream, padding: 7, marginTop: 6 }}>
      {children}
    </View>
  );
}

const money = (v: number, code: string) => `${fmtMillions(v)} ${code} m`;

/* ------------------------------------------------------------------------ */
/* The report                                                                */
/* ------------------------------------------------------------------------ */

export function ValuationReport({ result, meta }: { result: ValuationResult; meta: ReportMeta }) {
  const r = result;
  const h = headline(r);
  const c = r.currency;
  const unit = currencyMillions(c);
  const purpose = PURPOSES.find((p) => p.value === meta.purpose)?.label;
  const dateText = meta.generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const warnings = warningTexts(r);
  const who = meta.company || meta.preparedFor;
  const b = r.bridge;
  const bridgeItemsUsed = Boolean(b && (b.eosb || b.leases || b.minorityInterest || b.surplusAssets));
  const W = PAGE.contentWidth;
  const brand = meta.branding ?? null;
  const partner = brand?.partner ?? null;
  const about = descriptionParagraphs(meta.description);
  // Long company names step down so the cover never runs onto a second page.
  const titleSize = who.length > 80 ? 20 : who.length > 44 ? 26 : 34;

  return (
    <Document title={`Indicative valuation, ${who}`} author="PaceMakers Business Consultants" subject="Indicative business valuation">
      {/* 1. Cover */}
      <Page size="A4" style={{ fontFamily: 'Inter', fontFeatureSettings: NO_LIGATURES, backgroundColor: C.deep, color: C.white }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: C.gold }} />
        <View style={{ paddingHorizontal: 56, paddingTop: 64, flex: 1 }}>
          {brand?.logoOnDark ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={{ data: brand.logoOnDark, format: 'png' }} style={{ height: 34, width: 34 * LOGO_RATIO }} />
          ) : (
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 14 }}>PaceMakers Business Consultants</Text>
          )}
          <Text style={{ fontSize: 7.5, color: C.gold, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: brand?.logoOnDark ? 10 : 4 }}>Advisory from Structure to Exit</Text>

          <View style={{ marginTop: about.length ? 84 : 170 }}>
            <View style={{ height: 1.5, width: 64, backgroundColor: C.gold, marginBottom: 18 }} />
            <Text style={{ fontSize: 8.5, color: C.gold, letterSpacing: 1.6, textTransform: 'uppercase' }}>{REPORT_PAGE_TITLES[0]}</Text>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: titleSize, lineHeight: 1.1, marginTop: 12 }}>{who}</Text>
            <Text style={{ fontSize: 10.5, color: CREAM_ON_NAVY, marginTop: 10 }}>
              {meta.industry}, {meta.country}. Prepared {dateText}.
            </Text>
          </View>

          <View style={{ marginTop: about.length ? 32 : 56, borderTopWidth: 0.5, borderTopColor: '#E8DDC455', paddingTop: 22 }}>
            <Text style={{ fontSize: 8, color: CREAM_ON_NAVY, letterSpacing: 1.2, textTransform: 'uppercase' }}>Indicative equity value</Text>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 26, color: C.gold, marginTop: 8 }}>{h.equityRange}</Text>
            <Text style={{ fontSize: 10, color: CREAM_ON_NAVY, marginTop: 8 }}>
              Midpoint {h.midpoint} as at end of {h.valuationDate}. Enterprise value {h.evRange}.
            </Text>
          </View>

          {/* The visitor's own words about the business, set apart as theirs. */}
          {about.length > 0 && (
            <View style={{ marginTop: 26, borderLeftWidth: 2, borderLeftColor: C.gold, paddingLeft: 12 }}>
              <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 1.2, textTransform: 'uppercase' }}>About the business</Text>
              {about.map((para, i) => (
                <Text key={i} style={{ fontSize: 9.5, lineHeight: 1.5, color: C.white, marginTop: i ? 5 : 6 }}>
                  {para}
                </Text>
              ))}
              <Text style={{ fontSize: 7, color: CREAM_ON_NAVY, marginTop: 5 }}>As described by {meta.preparedFor}. Not reviewed by PaceMakers.</Text>
            </View>
          )}
        </View>
        <View style={{ paddingHorizontal: 56, paddingBottom: 40 }}>
          <Text style={{ fontSize: 7.5, color: CREAM_ON_NAVY, lineHeight: 1.5 }}>
            Prepared for {meta.preparedFor}. {dataVersionLabel(meta.dataVersion)}. {TOOL_DISCLAIMER}
          </Text>
        </View>
      </Page>

      {/* 2. Executive summary */}
      <ContentPage title={REPORT_PAGE_TITLES[1]} meta={meta}>
        <View style={s.section} wrap={false}>
          <Text style={s.eyebrow}>Indicative equity value, blended</Text>
          <Text style={[s.h1, { marginTop: 5 }]}>{h.equityRange}</Text>
          <Text style={{ fontSize: 10, marginTop: 5 }}>
            Midpoint <Text style={{ fontWeight: 600, color: C.goldMuted }}>{h.midpoint}</Text> as at end of {h.valuationDate}.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Tiles
              items={[
                ['WACC', h.wacc],
                ['Terminal value share', h.tvShare],
                ['Implied exit multiple', h.impliedExitMultiple],
                ['EV / LTM EBITDA', h.ltmMultiple],
              ]}
            />
          </View>
          {(h.weighted || h.stakeRange) && (
            <View style={{ marginTop: 8 }}>
              <Tiles
                items={[
                  ...(h.weighted ? ([['Probability-weighted equity', h.weighted]] as [string, string][]) : []),
                  ...(h.stakeRange ? ([[`Value of ${h.stakeLabel}`, h.stakeRange]] as [string, string][]) : []),
                ]}
              />
            </View>
          )}
        </View>
        <View wrap={false}>
          {executiveSummary(r).map((p, i) => (
            <Text key={i} style={[s.body, { marginBottom: 7 }]}>
              {p}
            </Text>
          ))}
        </View>
        <View style={{ marginTop: 8 }} wrap={false}>
          <KeyValues
            compact
            rows={[
              ['Prepared for', meta.preparedFor + (meta.company ? `, ${meta.company}` : '')],
              ...(purpose ? ([['Purpose', purpose]] as [string, string][]) : []),
              ['Methods', methodsUsed(r).join(', ')],
              ['Currency', `${c.code}, amounts in millions`],
              ['Market data', dataVersionLabel(meta.dataVersion)],
            ]}
          />
        </View>
      </ContentPage>

      {/* 3. Valuation summary */}
      <ContentPage title={REPORT_PAGE_TITLES[2]} meta={meta}>
        <Section title="Value by method" sub={`Enterprise value, ${unit}. The white line marks each midpoint.`}>
          <PdfChart chart={footballFieldChart(r)} width={W} />
        </Section>
        <Section title="From enterprise value to equity" sub={`Midpoint, ${unit}.`}>
          <PdfChart chart={waterfallChart(r, 760, 230)} width={W} />
          <View style={{ marginTop: 8 }}>
            <DataTable table={bridgeTable(r)} firstColWidth={46} />
          </View>
          {h.floorNote && (
            <Callout>
              <Text style={{ fontSize: 8.5 }}>{h.floorNote}</Text>
            </Callout>
          )}
        </Section>
      </ContentPage>

      {/* 4. Financial profile */}
      <ContentPage title={REPORT_PAGE_TITLES[3]} meta={meta}>
        <Section title="Revenue and EBITDA margin" sub={`Three actual years and five forecast years, ${unit}.`}>
          <PdfChart chart={revenueMarginChart(r, 760, 230)} width={W} />
        </Section>
        <Section title="Cash conversion" sub="Navy is EBITDA, green is free cash flow (red when negative). The percentage above each year is free cash flow over EBITDA.">
          <PdfChart chart={cashConversionChart(r, 760, 200)} width={W} />
        </Section>
        <Section title="Key ratios">
          <DataTable table={keyRatiosTable(r)} firstColWidth={70} />
        </Section>
      </ContentPage>

      {/* 5. DCF and sensitivity */}
      <ContentPage title={REPORT_PAGE_TITLES[4]} meta={meta}>
        <Section title="Free cash flow and DCF" sub={`Base case, ${unit}.`}>
          <DataTable table={fcfTable(r)} firstColWidth={38} />
          <Text style={s.note}>{TAX_NOTE}</Text>
        </Section>
        <Section
          title="Sensitivity"
          sub={`Equity value from the perpetuity growth DCF, ${unit}. Rows are WACC, columns long-term growth. The outlined cell is the base case.`}
        >
          <PdfChart chart={sensitivityHeatmap(r, 760, 230)} width={W} />
        </Section>
      </ContentPage>

      {/* 6. Scenarios, stake and checks */}
      <ContentPage title={REPORT_PAGE_TITLES[5]} meta={meta}>
        <Section title="Scenarios" sub="Each scenario moves forecast revenue growth and EBITDA margin in every year, and is valued with the same method.">
          {r.scenarios?.length ? (
            <DataTable table={scenariosTable(r)} colWidths={[18, 27, 10, 15, 15, 15]} />
          ) : (
            <Text style={s.body}>Scenarios were not computed for this version of the report.</Text>
          )}
        </Section>
        <Section title="Stake value">
          {r.stake?.used ? (
            <KeyValues
              rows={[
                ['Stake', stakeLabel(r)],
                ['Equity value, 100%', h.equityRange],
                ['Indicative value of the stake', h.stakeRange ?? ''],
              ]}
            />
          ) : (
            <Text style={s.body}>The valuation is for 100% of the equity, with no control premium or minority discount applied.</Text>
          )}
        </Section>
        <Section title="Checks" sub="Rule-based tests of the inputs and results.">
          {warnings.length ? (
            warnings.map((w) => (
              <Callout key={w.code} tone="red">
                <Text style={{ fontSize: 9, fontWeight: 600 }}>{w.title}</Text>
                <Text style={{ fontSize: 8.5, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>{w.detail}</Text>
              </Callout>
            ))
          ) : (
            <Text style={s.body}>None of the checks raised a warning.</Text>
          )}
        </Section>
      </ContentPage>

      {/* 7. What would increase your value */}
      <ContentPage title={REPORT_PAGE_TITLES[6]} meta={meta}>
        <Text style={[s.sub, { marginBottom: 14 }]}>Chosen by rule from your results. Most material first.</Text>
        {valueLevers(r).map((l, i) => (
          <View key={l.title} wrap={false} style={{ flexDirection: 'row', marginBottom: 14 }}>
            <Text style={{ fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600, fontSize: 18, color: C.gold, width: 30 }}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: 600 }}>{l.title}</Text>
              <Text style={[s.body, { color: C.muted, marginTop: 2 }]}>{l.detail}</Text>
            </View>
          </View>
        ))}
      </ContentPage>

      {/* 8. Assumptions */}
      <ContentPage title={REPORT_PAGE_TITLES[7]} meta={meta}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: '50%', paddingRight: 12 }} wrap={false}>
            <View style={s.rule} />
            <Text style={s.h2}>Cost of capital</Text>
            <KeyValues compact rows={waccBuildRows(r)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.navy, padding: 7, marginTop: 6 }}>
              <Text style={{ color: CREAM_ON_NAVY }}>WACC, {c.code}</Text>
              <Text style={{ color: C.gold, fontWeight: 600 }}>{h.wacc}</Text>
            </View>
          </View>
          <View style={{ width: '50%', paddingLeft: 12 }} wrap={false}>
            <View style={s.rule} />
            <Text style={s.h2}>Terminal value and comparables</Text>
            <KeyValues compact rows={terminalRows(r)} />
            <View style={{ marginTop: 14 }}>
              <View style={s.rule} />
              <Text style={s.h2}>Normalised EBITDA</Text>
              {r.normalisation?.used ? (
                <KeyValues compact rows={normalisationRows(r)} />
              ) : (
                <Text style={[s.body, { fontSize: 8.5 }]}>Reported EBITDA was used without adjustments.</Text>
              )}
            </View>
            <View style={{ marginTop: 14 }}>
              <View style={s.rule} />
              <Text style={s.h2}>Balance sheet items</Text>
              <KeyValues
                compact
                rows={[
                  ['Net debt', money(r.netDebt, c.code)],
                  ...(bridgeItemsUsed
                    ? ([
                        ['End of service benefits', money(b.eosb, c.code)],
                        ['Lease liabilities', money(b.leases, c.code)],
                        ['Minority interest', money(b.minorityInterest, c.code)],
                        ['Surplus assets', money(b.surplusAssets, c.code)],
                      ] as [string, string][])
                    : ([['Other claims and surplus assets', 'None entered']] as [string, string][])),
                ]}
              />
            </View>
          </View>
        </View>
      </ContentPage>

      {/* 9. Methodology and sources */}
      <ContentPage title={REPORT_PAGE_TITLES[8]} meta={meta}>
        <Section title="How the value was built">
          <Text style={[s.body, { marginBottom: 6 }]}>
            The discounted cash flow values five years of forecast free cash flow to the firm at the weighted average cost of capital, plus a
            terminal value calculated two ways: growth in perpetuity, and an exit multiple of EBITDA. The DCF range flexes WACC by one point and
            growth by half a point, or the exit multiple by one turn.
          </Text>
          <Text style={[s.body, { marginBottom: 6 }]}>
            The comparables method applies EV / EBITDA, or EV / Revenue where EBITDA is not positive, to the last actual year, using preset private
            company ranges or the peers entered, less any private company discount. The two methods are blended at the weight chosen, and net debt
            and the other balance sheet items are deducted to reach equity value.
          </Text>
          <Text style={s.body}>
            The cost of capital builds a cost of equity from a risk-free rate, a mature market equity risk premium, a country risk premium, an
            industry beta relevered to the target capital structure and a size premium, and a cost of debt from the risk-free rate and credit
            spreads.{c.pegged ? '' : ` For ${c.code}, the US dollar WACC is converted using the expected inflation gap.`}
          </Text>
        </Section>
        <Section title="Sources">
          {SOURCE_NOTES.map((note) => (
            <View key={note.label} style={{ marginBottom: 5 }}>
              <Text style={{ fontSize: 8.5, fontWeight: 500 }}>{note.label}</Text>
              <Text style={{ fontSize: 8.5, color: C.muted }}>
                {note.source}, {note.asOf}.
              </Text>
            </View>
          ))}
        </Section>
        <Section title="Important">
          <Text style={s.note}>{INDICATIVE_NOTE}</Text>
          <Text style={s.note}>{TOOL_DISCLAIMER}</Text>
          <Text style={s.note}>
            The figures in this report were calculated from the inputs entered and market data ({dataVersionLabel(meta.dataVersion)}). They have
            not been reviewed by PaceMakers and should not be relied on for a transaction, a financing or a tax or accounting purpose.
          </Text>
        </Section>
      </ContentPage>

      {/* 10. Working with PaceMakers */}
      <ContentPage title={REPORT_PAGE_TITLES[9]} meta={meta}>
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
              <Text style={{ fontSize: 8.5, color: C.text, marginTop: 1 }}>
                {[partner.role, partner.title].filter(Boolean).join(', ')}
              </Text>
              {partner.credentialsLine ? <Text style={{ fontSize: 8, color: C.goldMuted, fontWeight: 600, marginTop: 3 }}>{partner.credentialsLine}</Text> : null}
              {partner.intro ? <Text style={{ fontSize: 8.5, color: C.text, lineHeight: 1.5, marginTop: 6 }}>{partner.intro}</Text> : null}
              {partner.highlights.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  {partner.highlights.map((hl) => (
                    <View key={hl} style={{ flexDirection: 'row', marginTop: 2 }}>
                      <View style={{ width: 3.5, height: 3.5, backgroundColor: C.gold, marginTop: 3.6, marginRight: 5.5 }} />
                      <Text style={{ fontSize: 8, color: C.text, flex: 1, lineHeight: 1.4 }}>{hl}</Text>
                    </View>
                  ))}
                  <Text style={{ fontSize: 7, color: C.muted, marginTop: 3 }}>{PARTNER_RECORD_NOTE}</Text>
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
              {!partner && <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.4, marginTop: 1 }}>{svc.summary}</Text>}
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
            <Text style={{ fontSize: 7, color: CREAM_ON_NAVY, marginTop: 4 }}>Scan to book</Text>
          </View>
        </View>
        <Text style={[s.note, { marginTop: 12 }]}>advisory@pacemakersglobal.com  |  www.pacemakersglobal.com</Text>
      </ContentPage>
    </Document>
  );
}

/** Renders the report to a PDF buffer. */
export async function renderValuationReport(result: ValuationResult, meta: ReportMeta): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ValuationReport result={result} meta={meta} />);
}

/** A tidy attachment name: "PaceMakers valuation Acme 2026-09-16.pdf" without awkward characters. */
export function reportFileName(company: string | null, preparedFor: string, date: Date): string {
  const who = (company || preparedFor).replace(/[^A-Za-z0-9 ]+/g, '').trim().slice(0, 60) || 'report';
  return `PaceMakers valuation ${who} ${date.toISOString().slice(0, 10)}.pdf`;
}
