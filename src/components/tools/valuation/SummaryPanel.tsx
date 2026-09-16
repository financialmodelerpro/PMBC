'use client';

/**
 * The live summary beside the form: company, industry, country and currency, a
 * revenue and EBITDA sparkline, WACC once it can be computed, and the valuation
 * range, locked until the visitor has passed the gate.
 *
 * Two renderings of the same content. On large screens a sticky card in the
 * right-hand column. Below that a compact bar above the form that expands, so
 * the form keeps the full width on a tablet or a phone.
 */

import { useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';

import { sparkline } from '@/lib/tools/valuation/charts';
import type { Currency } from '@/lib/tools/valuation/engine';
import { fmtPct } from '@/lib/tools/valuation/format';

import { ChartSvg } from '../charts/ChartSvg';

export type SummaryData = {
  industry: string;
  country: string;
  currency: Currency;
  financialYear: string;
  revenue: number[];
  ebitda: number[];
  wacc: number | null;
  /** The equity range once revealed, already formatted. Null while locked. */
  range: string | null;
  midpoint: string | null;
};

function Rows({ d }: { d: SummaryData }) {
  const ltmRev = d.revenue[2], ltmEb = d.ebitda[2];
  const margin = Number.isFinite(ltmRev) && Number.isFinite(ltmEb) && ltmRev > 0 ? ltmEb / ltmRev : NaN;
  const rows: [string, string][] = [
    ['Industry', d.industry || 'Not chosen yet'],
    ['Country', d.country ? `${d.country}, ${d.currency.code}` : 'Not chosen yet'],
    ['Last financial year', d.financialYear ? `FY${d.financialYear}` : ''],
    ['LTM revenue', Number.isFinite(ltmRev) ? `${d.currency.code} ${ltmRev.toLocaleString('en-US', { maximumFractionDigits: 1 })} m` : 'Not entered'],
    ['LTM EBITDA margin', Number.isFinite(margin) ? fmtPct(margin, 1) : 'Not entered'],
    ['WACC', d.wacc !== null && Number.isFinite(d.wacc) ? fmtPct(d.wacc) : 'After step 3'],
  ];
  return (
    <dl className="divide-y divide-[color:var(--pmbc-border-warm)]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 py-2 text-[13.5px]">
          <dt className="text-[color:var(--pmbc-muted)]">{k}</dt>
          <dd className="text-right font-medium text-[color:var(--pmbc-text)] tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function RangeTeaser({ d }: { d: SummaryData }) {
  if (d.range) {
    return (
      <div className="rounded-[2px] bg-[#14304F] p-4 text-white">
        <p className="text-[11px] font-semibold uppercase text-[#C69C3E]" style={{ letterSpacing: '0.14em' }}>
          Indicative equity value
        </p>
        <p className="pmbc-display mt-1.5 text-[20px] leading-tight">{d.range}</p>
        {d.midpoint && <p className="mt-1 text-[13px] text-[#E8DDC4]">Midpoint {d.midpoint}</p>}
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-[2px] bg-[#14304F] p-4 text-white">
      <p className="text-[11px] font-semibold uppercase text-[#C69C3E]" style={{ letterSpacing: '0.14em' }}>
        Indicative equity value
      </p>
      <p aria-hidden className="pmbc-display mt-1.5 select-none text-[20px] leading-tight blur-[6px]">
        {d.currency.code} 000 million to {d.currency.code} 000 million
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[#E8DDC4]">
        <Lock aria-hidden size={13} />
        Revealed after the last step, with your free PDF report.
      </p>
    </div>
  );
}

export function SummaryPanel({ data }: { data: SummaryData }) {
  const [open, setOpen] = useState(false);
  const spark = sparkline(data.revenue, data.ebitda, 280, 60);
  const hasTrend = spark.prims.length > 0;

  return (
    <>
      {/* Large screens: sticky card. */}
      <aside aria-label="Valuation summary" className="hidden lg:block">
        <div className="sticky top-28 rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-5">
          <p className="text-[11px] font-semibold uppercase text-[#A88530]" style={{ letterSpacing: '0.16em' }}>
            Your valuation
          </p>
          <div className="mt-3">
            <Rows d={data} />
          </div>
          <div className="mt-4">
            <p className="mb-1 flex items-center justify-between text-[12px] text-[color:var(--pmbc-muted)]">
              <span>Revenue and EBITDA</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><i className="inline-block h-[3px] w-3 bg-[#1B3A5F]" />Revenue</span>
                <span className="flex items-center gap-1"><i className="inline-block h-[3px] w-3 bg-[#3FA663]" />EBITDA</span>
              </span>
            </p>
            {hasTrend ? (
              <ChartSvg chart={spark} />
            ) : (
              <p className="rounded-[2px] bg-[#FAF7F2] px-3 py-4 text-center text-[12.5px] text-[color:var(--pmbc-muted)]">Appears as you enter financials</p>
            )}
          </div>
          <div className="mt-4">
            <RangeTeaser d={data} />
          </div>
        </div>
      </aside>

      {/* Tablet and phone: compact bar that expands. */}
      <div className="rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50"
        >
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-[color:var(--pmbc-text)]">
              {data.industry || 'Your valuation'}
              {data.country ? `, ${data.currency.code}` : ''}
            </span>
            <span className="block truncate text-[12.5px] text-[color:var(--pmbc-muted)]">
              {data.range ? data.range : `WACC ${data.wacc !== null && Number.isFinite(data.wacc) ? fmtPct(data.wacc) : 'after step 3'}, range locked`}
            </span>
          </span>
          <ChevronDown aria-hidden size={18} className={`shrink-0 text-[#A88530] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="border-t border-[color:var(--pmbc-border-warm)] px-4 pt-2 pb-4">
            <Rows d={data} />
            {hasTrend && (
              <div className="mt-3">
                <ChartSvg chart={spark} />
              </div>
            )}
            <div className="mt-3">
              <RangeTeaser d={data} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
