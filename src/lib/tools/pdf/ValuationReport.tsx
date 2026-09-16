/**
 * The branded PDF valuation report, rendered on the server with @react-pdf/renderer.
 *
 * Everything it says comes from `format.ts`, the same module the results
 * screen and the emails use, so the three cannot disagree: the headline, the
 * football field rows and scale, the FCF, sensitivity and bridge tables, the
 * tax note, the negative equity note and the indicative-only wording.
 *
 * Five A4 pages, always, whatever the case: cover and headline; valuation
 * summary and revenue chart; the WACC build with sources; free cash flow and
 * sensitivity; the bridge, the call to action and the disclaimer. Each block is
 * kept whole (`wrap={false}`), and each page holds less than a full page even in
 * the longest case (a non-pegged currency adds lines to the WACC build), so a
 * table is never split and the page count never depends on the inputs.
 *
 * Charts are drawn with positioned boxes rather than SVG, which renders
 * identically across PDF viewers.
 *
 * Fonts are the site's, as WOFF, from ./fonts (see the README there).
 */

import path from 'node:path';

import { Document, Font, Link, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';

import { PURPOSES, SOURCE_NOTES } from '../valuation/data';
import type { ValuationResult } from '../valuation/engine';
import {
  INDICATIVE_NOTE,
  TAX_NOTE,
  TOOL_DISCLAIMER,
  bridgeTable,
  currencyMillions,
  equityFloorNote,
  fcfTable,
  fmtMillions,
  fmtPct,
  footballFieldRows,
  footballFieldScale,
  headline,
  methodsUsed,
  sensitivityTable,
  type Table,
} from '../valuation/format';

const C = {
  navy: '#1B3A5F',
  deep: '#14304F',
  gold: '#C69C3E',
  goldMuted: '#A88530',
  cream: '#FAF7F2',
  creamOnNavy: '#E8DDC4',
  text: '#0F1B2D',
  muted: '#52606B',
  border: '#E8E2D6',
  tint: '#F6F1E6',
  green: '#3FA663',
};

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), 'src', 'lib', 'tools', 'pdf', 'fonts');
  Font.register({
    family: 'Inter',
    fonts: [
      { src: path.join(dir, 'inter-latin-400-normal.woff'), fontWeight: 400 },
      { src: path.join(dir, 'inter-latin-500-normal.woff'), fontWeight: 500 },
      { src: path.join(dir, 'inter-latin-600-normal.woff'), fontWeight: 600 },
    ],
  });
  Font.register({
    family: 'SourceSerif',
    fonts: [
      { src: path.join(dir, 'source-serif-4-latin-400-normal.woff'), fontWeight: 400 },
      { src: path.join(dir, 'source-serif-4-latin-600-normal.woff'), fontWeight: 600 },
    ],
  });
  // Words are never hyphenated. Figures like "SAR 1.25 billion" must not break.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9.5, color: C.text, paddingTop: 48, paddingBottom: 56, paddingHorizontal: 44, backgroundColor: '#FFFFFF' },
  brandBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: C.navy },
  footer: { position: 'absolute', bottom: 22, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  eyebrow: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.4, color: C.goldMuted, textTransform: 'uppercase' },
  h1: { fontFamily: 'SourceSerif', fontWeight: 600, fontSize: 26, lineHeight: 1.15, color: C.text },
  h2: { fontFamily: 'SourceSerif', fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 3 },
  sub: { fontSize: 8.5, color: C.muted, marginBottom: 10, lineHeight: 1.45 },
  section: { marginBottom: 20 },
  note: { fontSize: 8, color: C.muted, lineHeight: 1.5, marginTop: 6 },
  rule: { height: 1, width: 40, backgroundColor: C.gold, marginBottom: 10 },
});

/* ------------------------------------------------------------------------ */

export type ReportMeta = {
  preparedFor: string;
  company: string | null;
  industry: string;
  country: string;
  purpose: string | null;
  generatedAt: Date;
  dataVersion: string;
  /** Tracked booking link for the closing call to action. */
  bookingHref: string;
};

function Footer({ meta }: { meta: ReportMeta }) {
  return (
    <View style={s.footer} fixed>
      <Text>PaceMakers Business Consultants LLP. Indicative only, not a valuation opinion.</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}  |  Data ${meta.dataVersion}`} />
    </View>
  );
}

function DataTable({ table, axis, firstColWidth = 34 }: { table: Table; axis?: boolean; firstColWidth?: number }) {
  const cols = table.head.length - 1;
  const other = (100 - firstColWidth) / cols;
  const centre = Math.floor(table.rows.length / 2);
  const cell = (w: number, align: 'left' | 'right') => ({ width: `${w}%`, paddingVertical: 3.5, paddingHorizontal: 5, textAlign: align });
  return (
    <View style={{ borderWidth: 0.5, borderColor: C.border }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.tint }}>
        {table.head.map((h, i) => (
          <Text key={i} style={[cell(i === 0 ? firstColWidth : other, i === 0 ? 'left' : 'right'), { fontSize: 7.5, fontWeight: 600, color: C.muted }]}>
            {h}
          </Text>
        ))}
      </View>
      {table.rows.map((row, ri) => {
        const strong = row.tone === 'strong';
        const muted = row.tone === 'muted';
        return (
          <View
            key={ri}
            style={{
              flexDirection: 'row',
              borderTopWidth: strong ? 1 : 0.5,
              borderTopColor: strong ? C.text : C.border,
            }}
          >
            <Text
              style={[
                cell(firstColWidth, 'left'),
                { fontWeight: strong || axis ? 600 : 400, color: muted || axis ? C.muted : C.text, backgroundColor: axis ? C.tint : undefined },
              ]}
            >
              {row.label}
            </Text>
            {row.values.map((v, ci) => {
              const base = axis && ri === centre && ci === centre;
              return (
                <Text
                  key={ci}
                  style={[
                    cell(other, 'right'),
                    { fontWeight: strong || base ? 600 : 400, color: muted ? C.muted : C.text, backgroundColor: base ? C.gold : undefined },
                  ]}
                >
                  {v}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function KeyValues({ rows }: { rows: [string, string][] }) {
  return (
    <View>
      {rows.map(([k, v], i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
          <Text style={{ color: C.muted }}>{k}</Text>
          <Text style={{ fontWeight: 500 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function FootballField({ result }: { result: ValuationResult }) {
  const rows = footballFieldRows(result);
  const scale = footballFieldScale(rows);
  return (
    <View>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
          <View style={{ width: '28%' }}>
            <Text style={{ fontWeight: 500 }}>{r.label}</Text>
            <Text style={{ fontSize: 7.5, color: C.muted }}>{r.sub}</Text>
          </View>
          <View style={{ width: '50%', height: 16, position: 'relative', backgroundColor: C.cream }}>
            {[25, 50, 75].map((p) => (
              <View key={p} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 0.5, backgroundColor: C.border }} />
            ))}
            {r.range ? (
              <>
                <View
                  style={{
                    position: 'absolute',
                    top: 3,
                    height: 10,
                    left: `${scale.pos(r.range[0])}%`,
                    width: `${Math.max(0.5, scale.pos(r.range[2]) - scale.pos(r.range[0]))}%`,
                    backgroundColor: r.blend ? C.gold : C.navy,
                  }}
                />
                <View style={{ position: 'absolute', top: 0, height: 16, width: 1.5, left: `${scale.pos(r.range[1])}%`, backgroundColor: r.blend ? C.text : C.goldMuted }} />
              </>
            ) : (
              <Text style={{ fontSize: 7.5, color: C.muted, paddingTop: 4, paddingLeft: 4 }}>Not meaningful with negative EBITDA</Text>
            )}
          </View>
          <Text style={{ width: '22%', textAlign: 'right', fontSize: 8, color: C.muted }}>
            {r.range ? `${fmtMillions(r.range[0])} to ${fmtMillions(r.range[2])}` : ''}
          </Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: '28%' }} />
        <View style={{ width: '50%', flexDirection: 'row', justifyContent: 'space-between' }}>
          {scale.ticks.map((t, i) => (
            <Text key={i} style={{ fontSize: 7, color: C.muted }}>
              {t}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function RevenueChart({ result }: { result: ValuationResult }) {
  const labels = [...result.years.history, ...result.years.forecast].map((y) => 'FY' + String(y).slice(2));
  const H = 130;
  const top = Math.max(...result.revenue) * 1.1;
  const low = Math.min(0, ...result.ebitda);
  const span = top - low;
  const zero = ((0 - low) / span) * H;
  const px = (v: number) => (Math.abs(v) / span) * H;
  return (
    <View>
      <View style={{ flexDirection: 'row', height: H + 14, alignItems: 'flex-end', borderBottomWidth: 0.5, borderBottomColor: C.border }}>
        {labels.map((l, i) => {
          const rv = result.revenue[i], eb = result.ebitda[i];
          return (
            <View key={i} style={{ flex: 1, height: H + 14, position: 'relative' }}>
              <Text style={{ position: 'absolute', bottom: zero + px(rv) + 2, left: 0, width: '62%', textAlign: 'center', fontSize: 7 }}>
                {Math.round(rv)}
              </Text>
              <View style={{ position: 'absolute', bottom: zero, left: '14%', width: '42%', height: px(rv), backgroundColor: i < 3 ? C.navy : C.gold }} />
              <View
                style={{
                  position: 'absolute',
                  bottom: eb >= 0 ? zero : zero - px(eb),
                  left: '58%',
                  width: '26%',
                  height: Math.max(0.5, px(eb)),
                  backgroundColor: C.green,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 3 }}>
        {labels.map((l, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 7.5, color: C.muted }}>
            {l}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {[
          [C.navy, 'Revenue, actual'],
          [C.gold, 'Revenue, forecast'],
          [C.green, 'EBITDA'],
        ].map(([c, l]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
            <View style={{ width: 7, height: 7, backgroundColor: c, marginRight: 4 }} />
            <Text style={{ fontSize: 7.5, color: C.muted }}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------------ */

export function ValuationReport({ result, meta }: { result: ValuationResult; meta: ReportMeta }) {
  const h = headline(result);
  const w = result.wacc;
  const unit = currencyMillions(result.currency);
  const floor = equityFloorNote(result.equityFloor);
  const purpose = PURPOSES.find((p) => p.value === meta.purpose)?.label;
  const dateText = meta.generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const waccRows: [string, string][] = [
    ['Risk-free rate', fmtPct(w.rf)],
    ['Mature market equity risk premium', fmtPct(w.erp)],
    ['Country risk premium', fmtPct(w.crp)],
    ['Unlevered beta', Number.isFinite(w.bu) ? w.bu.toFixed(2) : 'n/a'],
    ['Target debt to equity', fmtPct(w.de, 1)],
    ['Levered beta', Number.isFinite(w.bl) ? w.bl.toFixed(2) : 'n/a'],
    ['Size and company premium', fmtPct(w.sp, 1)],
    ['Cost of equity', fmtPct(w.ke)],
    ['Country default spread', fmtPct(w.ds)],
    ['Company credit spread', fmtPct(w.cs, 1)],
    ['Pre-tax cost of debt', fmtPct(w.kd)],
    ['Tax rate', fmtPct(w.t, 1)],
    ['After-tax cost of debt', fmtPct(w.kdt)],
    ['Equity weight', fmtPct(w.we, 1)],
    ['Debt weight', fmtPct(w.wd, 1)],
  ];
  if (!result.currency.pegged) waccRows.push(['WACC in US dollars', fmtPct(w.waccUsd)]);

  return (
    <Document title={`Indicative valuation, ${meta.company || meta.preparedFor}`} author="PaceMakers Business Consultants" subject="Indicative business valuation">
      {/* 1. Cover and headline */}
      <Page size="A4" style={[s.page, { paddingTop: 0 }]}>
        <View style={{ backgroundColor: C.navy, marginHorizontal: -44, paddingHorizontal: 44, paddingTop: 44, paddingBottom: 36 }}>
          <Text style={{ fontFamily: 'SourceSerif', fontWeight: 600, fontSize: 13, color: '#FFFFFF' }}>PaceMakers Business Consultants</Text>
          <Text style={{ fontSize: 7.5, color: C.gold, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 3 }}>Advisory from Structure to Exit</Text>
          <View style={{ height: 1, width: 48, backgroundColor: C.gold, marginTop: 40, marginBottom: 14 }} />
          <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 1.4, textTransform: 'uppercase' }}>Indicative business valuation</Text>
          <Text style={{ fontFamily: 'SourceSerif', fontWeight: 600, fontSize: 30, color: '#FFFFFF', marginTop: 8, lineHeight: 1.15 }}>
            {meta.company || meta.preparedFor}
          </Text>
          <Text style={{ fontSize: 10, color: C.creamOnNavy, marginTop: 8 }}>
            {meta.industry}, {meta.country}. Prepared {dateText}.
          </Text>
        </View>

        <View style={{ marginTop: 28 }}>
          <Text style={s.eyebrow}>Indicative equity value, blended</Text>
          <Text style={[s.h1, { marginTop: 6 }]}>{h.equityRange}</Text>
          <Text style={{ fontSize: 10.5, marginTop: 6 }}>
            Midpoint <Text style={{ fontWeight: 600, color: C.goldMuted }}>{h.midpoint}</Text> as at end of {h.valuationDate}. Enterprise value {h.evRange}.
          </Text>
          {floor && (
            <View style={{ marginTop: 10, borderLeftWidth: 2, borderLeftColor: C.gold, backgroundColor: C.cream, padding: 8 }}>
              <Text style={{ fontSize: 8.5, lineHeight: 1.45 }}>{floor}</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 18, borderWidth: 0.5, borderColor: C.border }}>
          {[
            ['WACC', h.wacc],
            ['Terminal value share of DCF', h.tvShare],
            ['Implied exit multiple', h.impliedExitMultiple],
            ['Implied EV / LTM EBITDA', h.ltmMultiple],
          ].map(([k, v], i) => (
            <View key={k} style={{ flex: 1, padding: 9, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: C.border }}>
              <Text style={{ fontSize: 7.5, color: C.muted }}>{k}</Text>
              <Text style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 22 }}>
          <Text style={s.h2}>About this report</Text>
          <KeyValues
            rows={[
              ['Prepared for', meta.preparedFor + (meta.company ? `, ${meta.company}` : '')],
              ...(purpose ? ([['Purpose', purpose]] as [string, string][]) : []),
              ['Methods', methodsUsed(result).join(', ')],
              ['Weighting', `${result.dcfWeight}% DCF, ${100 - result.dcfWeight}% comparables`],
              ['Currency', `${result.currency.code}, amounts in millions`],
              ['Discounting', result.midYear ? 'Mid-year convention' : 'End of year'],
              ['Market data version', meta.dataVersion],
            ]}
          />
          <Text style={s.note}>{INDICATIVE_NOTE}</Text>
        </View>
        <Footer meta={meta} />
      </Page>

      {/* 2. Summary and revenue */}
      <Page size="A4" style={s.page}>
        <View style={s.brandBar} fixed />
        <View style={s.section}>
          <View style={s.rule} />
          <Text style={s.h2}>Valuation summary</Text>
          <Text style={s.sub}>
            Enterprise value by method, {unit}. The line marks the midpoint. DCF ranges flex WACC by 1% and growth by 0.5%, or the exit multiple by 1x.
          </Text>
          <FootballField result={result} />
        </View>
        <View style={s.section}>
          <View style={s.rule} />
          <Text style={s.h2}>Revenue and EBITDA</Text>
          <Text style={s.sub}>Actuals and forecast, {unit}.</Text>
          <RevenueChart result={result} />
        </View>
        <Footer meta={meta} />
      </Page>

      {/* 3. Cost of capital */}
      <Page size="A4" style={s.page}>
        <View style={s.brandBar} fixed />
        <View style={s.section} wrap={false}>
          <View style={s.rule} />
          <Text style={s.h2}>Cost of capital</Text>
          <Text style={s.sub}>How the discount rate was built.</Text>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: '56%', paddingRight: 16 }}>
              <KeyValues rows={waccRows} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.navy, padding: 8, marginTop: 6 }}>
                <Text style={{ color: C.creamOnNavy }}>WACC, {result.currency.code}</Text>
                <Text style={{ color: C.gold, fontFamily: 'SourceSerif', fontWeight: 600, fontSize: 13 }}>{fmtPct(w.wacc)}</Text>
              </View>
              {!result.currency.pegged && (
                <Text style={s.note}>
                  {result.currency.code} is not pegged to the US dollar, so the US dollar WACC is converted using the expected inflation gap.
                </Text>
              )}
            </View>
            <View style={{ width: '44%' }}>
              <Text style={{ fontWeight: 600, marginBottom: 4 }}>Sources</Text>
              {SOURCE_NOTES.map((n) => (
                <View key={n.label} style={{ marginBottom: 5 }}>
                  <Text style={{ fontSize: 7.5, fontWeight: 500 }}>{n.label}</Text>
                  <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.35 }}>
                    {n.source}, {n.asOf}.
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <Footer meta={meta} />
      </Page>

      {/* 4. Free cash flow and sensitivity */}
      <Page size="A4" style={s.page}>
        <View style={s.brandBar} fixed />
        <View style={s.section} wrap={false}>
          <View style={s.rule} />
          <Text style={s.h2}>Free cash flow and DCF</Text>
          <Text style={s.sub}>Base case, {unit}.</Text>
          <DataTable table={fcfTable(result)} firstColWidth={40} />
          <Text style={s.note}>{TAX_NOTE}</Text>
        </View>
        <View style={s.section} wrap={false}>
          <View style={s.rule} />
          <Text style={s.h2}>Sensitivity</Text>
          <Text style={s.sub}>Equity value from the perpetuity growth DCF, {unit}. Rows are WACC, columns are long-term growth.</Text>
          <DataTable table={sensitivityTable(result)} axis firstColWidth={20} />
        </View>
        <Footer meta={meta} />
      </Page>

      {/* 5. Bridge, call to action, disclaimer */}
      <Page size="A4" style={s.page}>
        <View style={s.brandBar} fixed />
        <View style={s.section}>
          <View style={s.rule} />
          <Text style={s.h2}>Enterprise to equity value</Text>
          <DataTable table={bridgeTable(result)} firstColWidth={46} />
          {floor && <Text style={s.note}>{floor}</Text>}
          <Text style={s.note}>{INDICATIVE_NOTE}</Text>
        </View>

        <View style={{ backgroundColor: C.navy, padding: 16, marginTop: 4 }}>
          <Text style={{ fontFamily: 'SourceSerif', fontWeight: 600, fontSize: 14, color: '#FFFFFF' }}>Get a valuation you can defend</Text>
          <Text style={{ color: C.creamOnNavy, marginTop: 4, lineHeight: 1.45 }}>
            Book a free 30 minute call to review your model, assumptions and what an independent valuation would cover.
          </Text>
          <Link src={meta.bookingHref} style={{ marginTop: 8, color: C.gold, fontWeight: 600, textDecoration: 'none' }}>
            Book a free call
          </Link>
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={{ fontWeight: 600, marginBottom: 3 }}>Important</Text>
          <Text style={s.note}>{TOOL_DISCLAIMER}</Text>
          <Text style={s.note}>
            The figures in this report were calculated from the inputs you entered and market data dated {meta.dataVersion}. They have not been
            reviewed by PaceMakers and should not be relied on for a transaction, a financing or a tax or accounting purpose.
          </Text>
        </View>
        <Footer meta={meta} />
      </Page>
    </Document>
  );
}

/** Renders the report to a PDF buffer. */
export async function renderValuationReport(result: ValuationResult, meta: ReportMeta): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ValuationReport result={result} meta={meta} />);
}

/** A tidy attachment name: "PaceMakers valuation, Acme Ltd, 2026-09-16.pdf" without awkward characters. */
export function reportFileName(company: string | null, preparedFor: string, date: Date): string {
  const who = (company || preparedFor).replace(/[^A-Za-z0-9 ]+/g, '').trim().slice(0, 60) || 'report';
  return `PaceMakers valuation ${who} ${date.toISOString().slice(0, 10)}.pdf`;
}
