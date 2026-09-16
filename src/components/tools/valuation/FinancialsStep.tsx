'use client';

import { HISTORY_YEARS, TOTAL_YEARS, type LineKey } from '@/lib/tools/valuation/engine';

import type { FillKey, FormState } from './state';
import {
  ErrorText,
  Hint,
  INPUT_BLUE,
  NavRow,
  NumberInput,
  Panel,
  PanelTitle,
  TRACKING,
  buttonGhost,
  buttonPrimary,
  buttonSmall,
} from './ui';

const LINES: { k: LineKey; n: string; s?: string }[] = [
  { k: 'rev', n: 'Revenue' },
  { k: 'ebitda', n: 'EBITDA', s: 'Can be negative' },
  { k: 'da', n: 'Depreciation and amortisation' },
  { k: 'capex', n: 'Capital expenditure', s: 'Enter as a positive number' },
  { k: 'nwc', n: 'Net working capital', s: 'Balance at year end' },
];

const FILLS: { k: FillKey; label: string }[] = [
  { k: 'growth', label: 'Revenue growth' },
  { k: 'ebitdaMargin', label: 'EBITDA margin' },
  { k: 'daOfRevenue', label: 'D&A of revenue' },
  { k: 'capexOfRevenue', label: 'Capex of revenue' },
  { k: 'nwcOfRevenue', label: 'Working capital of revenue' },
];

export function FinancialsStep({
  state,
  currencyCode,
  years,
  error,
  onCell,
  onFillValue,
  onFill,
  onBack,
  onNext,
}: {
  state: FormState;
  currencyCode: string;
  years: { history: number[]; forecast: number[] };
  error: string;
  onCell: (k: LineKey, i: number, v: string) => void;
  onFillValue: (k: FillKey, v: string) => void;
  onFill: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const cols = Array.from({ length: TOTAL_YEARS }, (_, i) =>
    i < HISTORY_YEARS
      ? { label: `FY${years.history[i]} A`, aria: `FY${years.history[i]} actual`, forecast: false }
      : { label: `FY${years.forecast[i - HISTORY_YEARS]} F`, aria: `FY${years.forecast[i - HISTORY_YEARS]} forecast`, forecast: true },
  );
  const sep = (i: number) => (i === HISTORY_YEARS ? 'border-l-2 border-l-[#C69C3E]' : '');

  return (
    <Panel>
      <PanelTitle
        title="Historical and forecast financials"
        lead="Enter actuals for the last three years and your forecast for the next five. You can type every figure, or fill the forecast from simple assumptions and then edit."
      />

      {/* Scrolls sideways on a phone with the line names pinned, rather than
          squeezing eight columns of inputs into the viewport. */}
      <div className="overflow-x-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)]" tabIndex={0} aria-label="Financials table, scrolls horizontally">
        <table className="w-full border-collapse tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] min-w-[150px] border-b border-[color:var(--pmbc-border-warm)] bg-[#F6F1E6] px-2 py-2 text-left text-[13px] font-semibold text-[color:var(--pmbc-muted)]">
                {currencyCode} millions
              </th>
              {cols.map((c, i) => (
                <th
                  key={i}
                  className={`whitespace-nowrap border-b border-[color:var(--pmbc-border-warm)] bg-[#F6F1E6] px-1.5 py-2 text-center text-[13px] font-semibold ${c.forecast ? 'text-[#A88530]' : 'text-[color:var(--pmbc-muted)]'} ${sep(i)}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINES.map((line, r) => (
              <tr key={line.k}>
                <td
                  className={`sticky left-0 z-[1] min-w-[150px] bg-white px-2 py-1.5 text-left text-[14px] font-medium text-[color:var(--pmbc-text)] ${r < LINES.length - 1 ? 'border-b border-[color:var(--pmbc-border-warm)]' : ''}`}
                >
                  {line.n}
                  {line.s && <small className="block text-[12px] font-normal text-[color:var(--pmbc-muted)]">{line.s}</small>}
                </td>
                {cols.map((c, i) => (
                  <td
                    key={i}
                    className={`px-1.5 py-1.5 ${r < LINES.length - 1 ? 'border-b border-[color:var(--pmbc-border-warm)]' : ''} ${sep(i)}`}
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.1}
                      value={state.fin[line.k][i]}
                      onChange={(e) => onCell(line.k, i, e.target.value)}
                      aria-label={`${line.n} ${c.aria}`}
                      className="w-[92px] rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white px-2 py-1.5 text-right text-[14px] focus:border-[#C69C3E] focus:outline-none focus:ring-[3px] focus:ring-[#C69C3E]/25"
                      style={{ color: INPUT_BLUE }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorText>{error}</ErrorText>

      <div className="mt-4 rounded-[2px] bg-[#FAF7F2] p-4 sm:p-5">
        <strong className="text-[15px] text-[color:var(--pmbc-text)]">Fill the forecast from assumptions</strong>
        <Hint>Applied to every forecast year. Overwrites the forecast columns only.</Hint>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {FILLS.map((f) => (
            <div key={f.k}>
              <label htmlFor={`fill-${f.k}`} className="mb-1 block text-[13px] text-[color:var(--pmbc-text)]">
                {f.label}
              </label>
              <NumberInput id={`fill-${f.k}`} step={0.5} suffix="%" value={state.fill[f.k]} onValue={(v) => onFillValue(f.k, v)} />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button type="button" onClick={onFill} className={buttonSmall} style={TRACKING}>
            Fill forecast
          </button>
        </div>
      </div>

      <NavRow>
        <button type="button" onClick={onBack} className={buttonGhost} style={TRACKING}>
          Back
        </button>
        <button type="button" onClick={onNext} className={buttonPrimary} style={TRACKING}>
          Continue to cost of capital
        </button>
      </NavRow>
    </Panel>
  );
}
