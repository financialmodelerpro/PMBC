'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { PMBC } from '@/lib/public/tokens';
import type { ValuationResult } from '@/lib/tools/valuation/engine';
import {
  INDICATIVE_NOTE,
  TAX_NOTE,
  bridgeTable,
  fcfTable,
  sensitivityTable,
  type Table,
  type TableRow,
  currencyMillions,
  fmtMillions,
  footballFieldRows,
  footballFieldScale,
  headline,
} from '@/lib/tools/valuation/format';

import { Panel, TRACKING } from './ui';

const EBITDA_GREEN = PMBC.secondary;

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[color:var(--pmbc-border-warm)] py-6 last:border-b-0">
      <h3 className="font-serif text-[20px] font-semibold text-[color:var(--pmbc-text)]">{title}</h3>
      {sub && <p className="mt-1 mb-4 text-[14px] text-[#52606B]">{sub}</p>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function FootballField({ result }: { result: ValuationResult }) {
  const rows = footballFieldRows(result);
  const scale = footballFieldScale(rows);
  // Bars grow from zero width once mounted, as the reference animated them.
  // `motion-safe` on the transition leaves them static for reduced motion.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const track =
    'repeating-linear-gradient(90deg,transparent 0,transparent calc(25% - 1px),var(--pmbc-border-warm) calc(25% - 1px),var(--pmbc-border-warm) 25%)';

  return (
    <div>
      {rows.map((r) => {
        const valueText = r.range ? `${fmtMillions(r.range[0])} to ${fmtMillions(r.range[2])}` : '';
        return (
          <div key={r.key} className="grid items-center gap-x-3.5 gap-y-1 py-2.5 md:grid-cols-[190px_1fr_150px]">
            <div className="text-[15px] font-medium text-[color:var(--pmbc-text)]">
              {r.label}
              <small className="block text-[12.5px] font-normal text-[color:var(--pmbc-muted)]">{r.sub}</small>
            </div>
            <div
              className="relative h-[30px]"
              style={{ background: track }}
              role="img"
              aria-label={`${r.label}: ${r.range ? valueText : 'not available'}`}
            >
              {r.range ? (
                <>
                  <div
                    className="absolute top-[5px] h-5 rounded-[2px] motion-safe:transition-[width] motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(.2,.7,.2,1)]"
                    style={{
                      left: `${scale.pos(r.range[0])}%`,
                      width: grown ? `${Math.max(0.5, scale.pos(r.range[2]) - scale.pos(r.range[0]))}%` : 0,
                      background: r.blend ? PMBC.accent : PMBC.primary,
                    }}
                  />
                  <div
                    className="absolute top-0 h-[30px] w-[2px]"
                    style={{ left: `${scale.pos(r.range[1])}%`, background: r.blend ? PMBC.text : PMBC.accentMuted }}
                  />
                </>
              ) : (
                <div className="text-[13px] leading-[30px] text-[color:var(--pmbc-muted)]">Not meaningful with negative EBITDA</div>
              )}
            </div>
            <div className="text-[13px] tabular-nums text-[color:var(--pmbc-muted)] md:text-right">{valueText}</div>
          </div>
        );
      })}
      <div className="grid gap-x-3.5 text-[12px] text-[color:var(--pmbc-muted)] md:grid-cols-[190px_1fr_150px]">
        <span className="hidden md:block" />
        <div className="flex justify-between tabular-nums">
          {scale.ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        <span className="hidden md:block" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function RevenueChart({ result }: { result: ValuationResult }) {
  const labels = [...result.years.history, ...result.years.forecast].map((v) => 'FY' + String(v).slice(2));
  const revs = result.revenue, ebs = result.ebitda;
  const W = 800, H = 250, pad = 34, bw = (W - pad * 2) / 8;
  const top = Math.max(...revs) * 1.1, low = Math.min(0, ...ebs);
  const sc = (v: number) => H - 28 - ((v - low) / (top - low)) * (H - 50);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue and EBITDA by year" className="block h-auto w-full">
        <line x1={pad} x2={W - pad} y1={sc(0)} y2={sc(0)} stroke={PMBC.borderWarm} />
        {labels.map((l, i) => {
          const x = pad + i * bw, rv = revs[i], eb = ebs[i];
          const ey = eb >= 0 ? sc(eb) : sc(0), eh = Math.abs(sc(0) - sc(eb));
          return (
            <g key={l + i}>
              <rect x={x + bw * 0.14} y={sc(rv)} width={bw * 0.42} height={sc(0) - sc(rv)} fill={i < 3 ? PMBC.primary : PMBC.accent} rx={2} />
              <rect x={x + bw * 0.58} y={ey} width={bw * 0.26} height={eh} fill={EBITDA_GREEN} rx={2} />
              <text x={x + bw * 0.5} y={H - 8} fontSize={13} textAnchor="middle" fill={PMBC.muted}>
                {l}
              </text>
              <text x={x + bw * 0.35} y={sc(rv) - 6} fontSize={11.5} textAnchor="middle" fill={PMBC.text}>
                {Math.round(rv)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4.5 gap-y-1 text-[13px] text-[color:var(--pmbc-muted)]">
        {[
          [PMBC.primary, 'Revenue, actual'],
          [PMBC.accent, 'Revenue, forecast'],
          [EBITDA_GREEN, 'EBITDA'],
        ].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-3 w-3 rounded-[2px]" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

const cellBase = 'whitespace-nowrap border-b border-[color:var(--pmbc-border-warm)] px-2.5 py-2';
const firstCol = 'sticky left-0 z-[1] text-left';
// Alignment lives on each column rather than in cellBase: two text-align
// utilities on one element resolve by stylesheet order, not class order.
const numCol = 'text-right';

const toneClass = (tone?: TableRow['tone']) =>
  tone === 'strong'
    ? 'font-semibold border-t-2 border-t-[color:var(--pmbc-text)]'
    : tone === 'muted'
      ? 'text-[color:var(--pmbc-muted)]'
      : 'text-[color:var(--pmbc-text)]';

/**
 * Renders a table built by `format.ts`, which the PDF reads too. `axis` marks
 * the sensitivity grid, whose header row and first column are both axes and
 * whose centre cell is the base case.
 */
function DataTable({ table, axis }: { table: Table; axis?: boolean }) {
  const axisBg = axis ? 'bg-[#F6F1E6]' : '';
  // The pinned column needs an opaque ground to cover cells scrolling under it.
  const pinnedBg = axis ? axisBg : 'bg-white';
  const centre = Math.floor(table.rows.length / 2);
  return (
    <div className="overflow-x-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)]" tabIndex={0}>
      <table className="w-full border-collapse text-[14px] tabular-nums">
        <thead>
          <tr className="text-[13px] text-[color:var(--pmbc-muted)]">
            {table.head.map((h, i) => (
              <th key={i} className={`${cellBase} ${i === 0 ? `${firstCol} ${pinnedBg}` : `${numCol} ${axisBg}`} font-semibold`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {axis ? (
                <th className={`${cellBase} ${firstCol} ${axisBg} font-semibold text-[color:var(--pmbc-muted)]`}>{row.label}</th>
              ) : (
                <td className={`${cellBase} ${firstCol} bg-white ${toneClass(row.tone)}`}>{row.label}</td>
              )}
              {row.values.map((v, ci) => {
                const isBase = axis && ri === centre && ci === centre;
                return (
                  <td
                    key={ci}
                    className={`${cellBase} ${numCol} ${isBase ? 'font-semibold text-[#14304F]' : toneClass(row.tone)}`}
                    style={isBase ? { background: PMBC.accent } : undefined}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

export function Results({
  result,
  bookingHref,
  onBookClick,
  onEdit,
}: {
  result: ValuationResult;
  bookingHref: string;
  onBookClick?: () => void;
  onEdit: () => void;
}) {
  const h = headline(result);
  const unit = currencyMillions(result.currency);
  const kpis: [string, string][] = [
    ['WACC', h.wacc],
    ['Terminal value share of DCF', h.tvShare],
    ['Implied exit multiple', h.impliedExitMultiple],
    ['Implied EV / LTM EBITDA', h.ltmMultiple],
  ];
  const external = /^https?:/i.test(bookingHref);

  return (
    <Panel>
      <div className="border-b border-[color:var(--pmbc-border-warm)] pb-6">
        <p className="text-[15px] text-[color:var(--pmbc-muted)]">Indicative equity value, blended</p>
        <p className="pmbc-display my-2 text-[30px] leading-[1.1] text-[color:var(--pmbc-text)] sm:text-[44px]" data-testid="equity-range">
          {h.equityRange}
        </p>
        <p className="text-[15px] text-[color:var(--pmbc-text)]">
          Midpoint <b className="text-[#A88530]">{h.midpoint}</b> as at end of {h.valuationDate}. Enterprise value {h.evRange}.
        </p>
        {h.floorNote && (
          <p className="mt-3 border-l-2 border-[#C69C3E] bg-[#FAF7F2] px-3 py-2 text-[14px] leading-[1.55] text-[color:var(--pmbc-text)]" role="note">
            {h.floorNote}
          </p>
        )}
        <dl className="mt-5 grid grid-cols-2 rounded-[2px] border border-[color:var(--pmbc-border-warm)] md:grid-cols-4">
          {kpis.map(([k, v], i) => (
            <div
              key={k}
              className={`px-3.5 py-3 ${i < 3 ? 'md:border-r' : ''} ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b md:border-b-0' : ''} border-[color:var(--pmbc-border-warm)]`}
            >
              <dt className="text-[13px] text-[color:var(--pmbc-muted)]">{k}</dt>
              <dd className="text-[19px] font-semibold tabular-nums text-[color:var(--pmbc-text)]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Section
        title="Valuation summary"
        sub={`Enterprise value by method, ${unit}. Line marks the midpoint. DCF ranges flex WACC by 1% and growth by 0.5% or the exit multiple by 1x.`}
      >
        <FootballField result={result} />
      </Section>

      <Section title="Revenue and EBITDA" sub={`Actuals and forecast, ${unit}.`}>
        <RevenueChart result={result} />
      </Section>

      <Section title="Free cash flow and DCF" sub={`Base case, ${unit}.`}>
        <DataTable table={fcfTable(result)} />
        <p className="mt-3 text-[13.5px] leading-[1.6] text-[color:var(--pmbc-muted)]">{TAX_NOTE}</p>
      </Section>

      <Section title="Sensitivity" sub={`Equity value from the perpetuity growth DCF, ${unit}.`}>
        <DataTable table={sensitivityTable(result)} axis />
      </Section>

      <Section title="Enterprise to equity value">
        <DataTable table={bridgeTable(result)} />
        <p className="mt-3 text-[13.5px] leading-[1.6] text-[color:var(--pmbc-muted)]">{INDICATIVE_NOTE}</p>
      </Section>

      <div className="mt-7 flex flex-col items-start justify-between gap-6 rounded-[2px] bg-[#1B3A5F] p-6 sm:p-7 md:flex-row md:items-center">
        <div>
          <h4 className="pmbc-display text-[22px] text-white">Get a valuation you can defend</h4>
          <p className="mt-1 max-w-[44ch] text-[15px] leading-[1.6] text-[#E8DDC4]">
            Book a free 30 minute call to review your model, assumptions and what an independent valuation would cover.
          </p>
        </div>
        <a
          href={bookingHref}
          onClick={onBookClick}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className="inline-flex shrink-0 items-center gap-2 border border-[#C69C3E] bg-[#C69C3E] px-6 py-3 text-[12px] font-semibold uppercase text-[#14304F] transition-colors duration-200 hover:bg-transparent hover:text-white"
          style={TRACKING}
        >
          Book a free call
          <ArrowUpRight size={14} />
        </a>
      </div>
      <div className="mt-6">
        <button
          type="button"
          onClick={onEdit}
          className="text-[14px] text-[color:var(--pmbc-muted)] underline underline-offset-4 hover:text-[color:var(--pmbc-primary)]"
        >
          Change inputs and rerun
        </button>
      </div>
    </Panel>
  );
}
