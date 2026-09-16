/**
 * Chart geometry, shared by the results dashboard and the PDF report.
 *
 * Each function turns a `ValuationResult` into a list of drawing primitives in
 * its own coordinate space (a `viewBox`). The page draws them as SVG
 * (`src/components/tools/charts/ChartSvg.tsx`) and the PDF draws the same list
 * with react-pdf's `Svg` (`src/lib/tools/pdf/PdfChart.tsx`). Same geometry, same
 * colours, same labels, so a chart on screen and in the report cannot drift.
 *
 * No React and no DOM here, so the geometry is testable on its own.
 */

import type { Range3, ValuationResult } from './engine';
import {
  bridgeSteps,
  fmtMillions,
  fmtPct,
  footballFieldRows,
  footballFieldScale,
  type FootballFieldRow,
} from './format';

export const CHART_COLORS = {
  navy: '#1B3A5F',
  deep: '#14304F',
  gold: '#C69C3E',
  goldMuted: '#A88530',
  cream: '#FAF7F2',
  tint: '#F6F1E6',
  border: '#E8E2D6',
  text: '#0F1B2D',
  muted: '#52606B',
  green: '#3FA663',
  red: '#B3412F',
  white: '#FFFFFF',
} as const;

export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string; rx?: number; opacity?: number; stroke?: string; strokeWidth?: number; hint?: string }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number; dash?: string }
  | { t: 'text'; x: number; y: number; text: string; size: number; fill: string; anchor: 'start' | 'middle' | 'end'; weight?: 400 | 500 | 600; family?: 'sans' | 'serif' }
  | { t: 'path'; d: string; stroke?: string; fill?: string; width?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number };

export type Chart = {
  width: number;
  height: number;
  prims: Prim[];
  /** Plain-language description, for `aria-label` and the PDF's alternative text. */
  label: string;
};

const C = CHART_COLORS;
const round = (v: number) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------------ */
/* Football field                                                            */
/* ------------------------------------------------------------------------ */

export function footballFieldChart(r: ValuationResult, width = 760): Chart {
  const rows = footballFieldRows(r);
  const scale = footballFieldScale(rows);
  const labelW = 190, valueW = 130, gap = 14;
  const trackX = labelW + gap, trackW = width - labelW - valueW - gap * 2;
  const rowH = 44, top = 6;
  const prims: Prim[] = [];
  rows.forEach((row: FootballFieldRow, i) => {
    const y = top + i * rowH;
    prims.push({ t: 'text', x: 0, y: y + 16, text: row.label, size: 13, fill: C.text, anchor: 'start', weight: 500 });
    prims.push({ t: 'text', x: 0, y: y + 32, text: row.sub, size: 10.5, fill: C.muted, anchor: 'start' });
    prims.push({ t: 'rect', x: trackX, y: y + 8, w: trackW, h: 24, fill: C.cream });
    for (const p of [0.25, 0.5, 0.75]) {
      prims.push({ t: 'line', x1: trackX + trackW * p, y1: y + 8, x2: trackX + trackW * p, y2: y + 32, stroke: C.border, width: 1 });
    }
    if (row.range) {
      const x0 = trackX + (scale.pos(row.range[0]) / 100) * trackW;
      const x1 = trackX + (scale.pos(row.range[2]) / 100) * trackW;
      const xm = trackX + (scale.pos(row.range[1]) / 100) * trackW;
      const fill = row.blend ? C.gold : row.key === 'scenarios' ? C.goldMuted : C.navy;
      prims.push({
        t: 'rect', x: round(x0), y: y + 12, w: round(Math.max(2, x1 - x0)), h: 16, fill, rx: 2,
        hint: `${row.label}: ${fmtMillions(row.range[0])} to ${fmtMillions(row.range[2])}, midpoint ${fmtMillions(row.range[1])}`,
      });
      prims.push({ t: 'rect', x: round(xm - 1), y: y + 8, w: 2, h: 24, fill: row.blend ? C.text : C.white });
      prims.push({
        t: 'text', x: width, y: y + 25, text: `${fmtMillions(row.range[0])} to ${fmtMillions(row.range[2])}`,
        size: 11, fill: C.muted, anchor: 'end',
      });
    } else {
      prims.push({ t: 'text', x: trackX + 8, y: y + 25, text: 'Not meaningful with negative EBITDA', size: 11, fill: C.muted, anchor: 'start' });
    }
  });
  const axisY = top + rows.length * rowH + 12;
  scale.ticks.forEach((tick, i) => {
    const x = trackX + (trackW * i) / 4;
    prims.push({ t: 'text', x, y: axisY, text: tick, size: 10, fill: C.muted, anchor: i === 0 ? 'start' : i === 4 ? 'end' : 'middle' });
  });
  return {
    width,
    height: axisY + 6,
    prims,
    label: `Valuation summary by method, ${r.currency.code} millions: ${rows
      .map((row) => (row.range ? `${row.label} ${fmtMillions(row.range[0])} to ${fmtMillions(row.range[2])}` : `${row.label} not available`))
      .join('; ')}.`,
  };
}

/* ------------------------------------------------------------------------ */
/* Value bridge waterfall                                                    */
/* ------------------------------------------------------------------------ */

export function waterfallChart(r: ValuationResult, width = 760, height = 260): Chart {
  const steps = bridgeSteps(r);
  const padL = 8, padR = 8, padTop = 24, padBottom = 44;
  const colW = (width - padL - padR) / steps.length;
  // Running totals, so each bar floats from where the previous one ended.
  let running = 0;
  const bars = steps.map((s) => {
    if (s.kind === 'total') {
      running = s.value;
      return { ...s, from: 0, to: s.value };
    }
    const from = running;
    running += s.value;
    return { ...s, from, to: running };
  });
  const vals = bars.flatMap((b) => [b.from, b.to, 0]);
  const hi = Math.max(...vals), lo = Math.min(...vals);
  const span = hi - lo || 1;
  const plotH = height - padTop - padBottom;
  const y = (v: number) => padTop + ((hi - v) / span) * plotH;
  const prims: Prim[] = [{ t: 'line', x1: padL, y1: y(0), x2: width - padR, y2: y(0), stroke: C.border, width: 1 }];
  bars.forEach((b, i) => {
    const x = padL + i * colW + colW * 0.2, w = colW * 0.6;
    const yTop = y(Math.max(b.from, b.to)), yBot = y(Math.min(b.from, b.to));
    const fill = b.kind === 'total' ? (i === 0 ? C.navy : C.gold) : b.kind === 'less' ? C.red : C.green;
    prims.push({ t: 'rect', x: round(x), y: round(yTop), w: round(w), h: round(Math.max(1.5, yBot - yTop)), fill, rx: 2, hint: `${b.label}: ${fmtMillions(b.value)}` });
    if (i < bars.length - 1) {
      prims.push({ t: 'line', x1: round(x + w), y1: round(y(b.to)), x2: round(x + colW), y2: round(y(b.to)), stroke: C.muted, width: 0.8, dash: '3 3' });
    }
    prims.push({ t: 'text', x: round(x + w / 2), y: round(yTop - 7), text: fmtMillions(b.value), size: 11, fill: C.text, anchor: 'middle', weight: 600 });
    const words = b.label.split(' ');
    const mid = Math.ceil(words.length / 2);
    const lines = words.length > 2 ? [words.slice(0, mid).join(' '), words.slice(mid).join(' ')] : [b.label];
    lines.forEach((line, li) => {
      prims.push({ t: 'text', x: round(x + w / 2), y: height - padBottom + 18 + li * 13, text: line, size: 10.5, fill: C.muted, anchor: 'middle' });
    });
  });
  return {
    width,
    height,
    prims,
    label: `Value bridge at the midpoint, ${r.currency.code} millions: ${steps.map((s) => `${s.label} ${fmtMillions(s.value)}`).join(', ')}.`,
  };
}

/* ------------------------------------------------------------------------ */
/* Revenue and EBITDA margin over eight years                                */
/* ------------------------------------------------------------------------ */

function yearLabels(r: ValuationResult): string[] {
  return [...r.years.history, ...r.years.forecast].map((v) => 'FY' + String(v).slice(2));
}

export function revenueMarginChart(r: ValuationResult, width = 760, height = 250): Chart {
  return revenueMarginSeriesChart(yearLabels(r), r.revenue, r.ebitda, width, height);
}

/**
 * The same chart from plain series, for the financials step, where the figures
 * exist before any valuation has run. Eight years: three actual (navy) then
 * forecast (gold). Callers draw it only once every year has revenue above zero
 * and a number for EBITDA, so a half-typed table never draws a misleading chart.
 */
export function revenueMarginSeriesChart(
  labels: string[],
  revenue: number[],
  ebitda: number[],
  width = 760,
  height = 250,
): Chart {
  const r = { revenue, ebitda };
  const padL = 10, padR = 44, padTop = 22, padBottom = 30;
  const plotW = width - padL - padR, plotH = height - padTop - padBottom;
  const colW = plotW / labels.length;
  const maxRev = Math.max(...r.revenue) * 1.1;
  const margins = r.revenue.map((rev, i) => r.ebitda[i] / rev);
  const mLo = Math.min(0, ...margins), mHi = Math.max(0.05, ...margins) * 1.15;
  const yRev = (v: number) => padTop + plotH - (v / maxRev) * plotH;
  const yM = (v: number) => padTop + plotH - ((v - mLo) / (mHi - mLo)) * plotH;
  const prims: Prim[] = [{ t: 'line', x1: padL, y1: padTop + plotH, x2: width - padR, y2: padTop + plotH, stroke: C.border, width: 1 }];
  labels.forEach((l, i) => {
    const x = padL + i * colW;
    const rv = r.revenue[i];
    prims.push({ t: 'rect', x: round(x + colW * 0.2), y: round(yRev(rv)), w: round(colW * 0.6), h: round(padTop + plotH - yRev(rv)), fill: i < 3 ? C.navy : C.gold, rx: 2, hint: `${l} revenue ${fmtMillions(rv)}, EBITDA margin ${fmtPct(margins[i], 1)}` });
    prims.push({ t: 'text', x: round(x + colW / 2), y: round(yRev(rv) - 6), text: String(Math.round(rv)), size: 10.5, fill: C.text, anchor: 'middle' });
    prims.push({ t: 'text', x: round(x + colW / 2), y: height - 10, text: l, size: 11, fill: C.muted, anchor: 'middle' });
  });
  const pts = margins.map((m, i) => [round(padL + i * colW + colW / 2), round(yM(m))] as const);
  prims.push({ t: 'path', d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' '), stroke: C.green, width: 2.2 });
  pts.forEach((p, i) => {
    prims.push({ t: 'circle', cx: p[0], cy: p[1], r: 3.2, fill: C.white, stroke: C.green, strokeWidth: 2 });
    if (i === 2 || i === pts.length - 1) {
      prims.push({ t: 'text', x: p[0], y: round(p[1] - 8), text: fmtPct(margins[i], 1), size: 10, fill: C.green, anchor: 'middle', weight: 600 });
    }
  });
  prims.push({ t: 'text', x: width - 2, y: padTop - 8, text: 'EBITDA margin', size: 10, fill: C.green, anchor: 'end' });
  return {
    width,
    height,
    prims,
    label: `Revenue by year with EBITDA margin: ${labels.map((l, i) => `${l} revenue ${Math.round(r.revenue[i])}, margin ${fmtPct(margins[i], 1)}`).join('; ')}.`,
  };
}

/* ------------------------------------------------------------------------ */
/* Cash conversion over the forecast                                         */
/* ------------------------------------------------------------------------ */

export function cashConversionChart(r: ValuationResult, width = 760, height = 230): Chart {
  const labels = r.years.forecast.map((v) => 'FY' + String(v).slice(2));
  const padL = 10, padR = 10, padTop = 26, padBottom = 30;
  const plotW = width - padL - padR, plotH = height - padTop - padBottom;
  const colW = plotW / labels.length;
  const vals = r.rows.flatMap((x) => [x.ebitda, x.fcf, 0]);
  const hi = Math.max(...vals) * 1.12, lo = Math.min(...vals);
  const span = hi - lo || 1;
  const y = (v: number) => padTop + ((hi - v) / span) * plotH;
  const prims: Prim[] = [{ t: 'line', x1: padL, y1: y(0), x2: width - padR, y2: y(0), stroke: C.border, width: 1 }];
  r.rows.forEach((row, i) => {
    const x = padL + i * colW;
    const bw = colW * 0.3;
    const eTop = y(Math.max(0, row.ebitda)), eBot = y(Math.min(0, row.ebitda));
    const fTop = y(Math.max(0, row.fcf)), fBot = y(Math.min(0, row.fcf));
    prims.push({ t: 'rect', x: round(x + colW * 0.18), y: round(eTop), w: round(bw), h: round(Math.max(1, eBot - eTop)), fill: C.navy, rx: 2, hint: `${labels[i]} EBITDA ${fmtMillions(row.ebitda)}` });
    prims.push({ t: 'rect', x: round(x + colW * 0.52), y: round(fTop), w: round(bw), h: round(Math.max(1, fBot - fTop)), fill: row.fcf < 0 ? C.red : C.green, rx: 2, hint: `${labels[i]} free cash flow ${fmtMillions(row.fcf)}` });
    const conv = row.ebitda > 0 ? row.fcf / row.ebitda : NaN;
    prims.push({ t: 'text', x: round(x + colW / 2), y: padTop - 10, text: Number.isFinite(conv) ? fmtPct(conv, 0) : 'n/a', size: 10.5, fill: C.text, anchor: 'middle', weight: 600 });
    prims.push({ t: 'text', x: round(x + colW / 2), y: height - 10, text: labels[i], size: 11, fill: C.muted, anchor: 'middle' });
  });
  return {
    width,
    height,
    prims,
    label: `EBITDA and free cash flow by forecast year, with conversion: ${r.rows
      .map((row, i) => `${labels[i]} EBITDA ${fmtMillions(row.ebitda)}, free cash flow ${fmtMillions(row.fcf)}`)
      .join('; ')}.`,
  };
}

/* ------------------------------------------------------------------------ */
/* Sensitivity heatmap                                                       */
/* ------------------------------------------------------------------------ */

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Colour for a heatmap cell: pale gold for the lowest value to navy for the highest. */
export function heatColor(v: number, lo: number, hi: number): { fill: string; text: string } {
  if (!Number.isFinite(v)) return { fill: C.tint, text: C.muted };
  const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
  const fill = t < 0.5 ? mix('#F3E3BC', '#FFFFFF', t * 2) : mix('#FFFFFF', C.navy, (t - 0.5) * 2);
  return { fill, text: t > 0.62 ? C.white : C.text };
}

export function sensitivityHeatmap(r: ValuationResult, width = 760, height = 240): Chart {
  const { waccs, growths, grid } = r.sensitivity;
  const labelW = 90, headH = 34;
  const cellW = (width - labelW) / growths.length, cellH = (height - headH) / waccs.length;
  const finite = grid.flat().filter(Number.isFinite);
  const lo = Math.min(...finite), hi = Math.max(...finite);
  const prims: Prim[] = [
    { t: 'text', x: 0, y: 14, text: 'WACC \\ growth', size: 10.5, fill: C.muted, anchor: 'start', weight: 600 },
  ];
  growths.forEach((g, j) => {
    prims.push({ t: 'text', x: round(labelW + j * cellW + cellW / 2), y: 22, text: fmtPct(g, 1), size: 11, fill: C.muted, anchor: 'middle', weight: 600 });
  });
  waccs.forEach((w, i) => {
    const y = headH + i * cellH;
    prims.push({ t: 'text', x: 0, y: round(y + cellH / 2 + 4), text: fmtPct(w, 1), size: 11, fill: C.muted, anchor: 'start', weight: 600 });
    grid[i].forEach((v, j) => {
      const x = labelW + j * cellW;
      const col = heatColor(v, lo, hi);
      const base = i === 2 && j === 2;
      prims.push({
        t: 'rect', x: round(x + 1), y: round(y + 1), w: round(cellW - 2), h: round(cellH - 2), fill: col.fill, rx: 2,
        stroke: base ? C.gold : undefined, strokeWidth: base ? 3 : undefined,
        hint: `WACC ${fmtPct(w, 1)}, growth ${fmtPct(growths[j], 1)}: equity ${fmtMillions(v)}`,
      });
      prims.push({ t: 'text', x: round(x + cellW / 2), y: round(y + cellH / 2 + 4), text: fmtMillions(v), size: 11.5, fill: col.text, anchor: 'middle', weight: base ? 600 : 400 });
    });
  });
  return {
    width,
    height,
    prims,
    label: `Sensitivity of equity value to WACC and long-term growth, ${r.currency.code} millions. Base case ${fmtMillions(grid[2][2])}.`,
  };
}

/* ------------------------------------------------------------------------ */
/* Sparkline                                                                 */
/* ------------------------------------------------------------------------ */

export function sparkline(revenue: number[], ebitda: number[], width = 260, height = 56): Chart {
  const valid = revenue.map((v, i) => Number.isFinite(v) && Number.isFinite(ebitda[i]));
  const revs = revenue.filter((_, i) => valid[i]);
  const prims: Prim[] = [];
  if (revs.length < 2) return { width, height, prims, label: 'Enter financials to see the trend.' };
  const all = [...revenue, ...ebitda].filter(Number.isFinite);
  const hi = Math.max(...all), lo = Math.min(0, ...all);
  const step = width / (revenue.length - 1);
  const y = (v: number) => 4 + ((hi - v) / (hi - lo || 1)) * (height - 8);
  const line = (vals: number[]) =>
    vals
      .map((v, i) => (Number.isFinite(v) ? [round(i * step), round(y(v))] : null))
      .filter((p): p is number[] => p !== null)
      .map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`)
      .join(' ');
  prims.push({ t: 'line', x1: round(step * 2.5), y1: 0, x2: round(step * 2.5), y2: height, stroke: C.border, width: 1, dash: '2 3' });
  prims.push({ t: 'path', d: line(revenue), stroke: C.navy, width: 2 });
  prims.push({ t: 'path', d: line(ebitda), stroke: C.green, width: 2 });
  return { width, height, prims, label: 'Revenue and EBITDA trend, actual years then forecast.' };
}

/** Exposed for the dashboard's interactive football field. */
export function rangeText(range: Range3 | null): string {
  return range ? `${fmtMillions(range[0])} to ${fmtMillions(range[2])}` : 'Not available';
}
