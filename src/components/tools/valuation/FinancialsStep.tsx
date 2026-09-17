'use client';

import { revenueMarginSeriesChart } from '@/lib/tools/valuation/charts';
import { HISTORY_YEARS, TOTAL_YEARS, type LineKey } from '@/lib/tools/valuation/engine';
import { fmtMillions } from '@/lib/tools/valuation/format';

import { ChartSvg } from '../charts/ChartSvg';
import { investedCapitalOf, num, type FillKey, type FormState } from './state';
import { Collapsible, ErrorText, Field, Hint, INPUT_BLUE, NumberInput, Panel, PanelTitle, StepNav, TRACKING, buttonSmall } from './ui';

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
  onNorm,
  onChange,
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
  onNorm: (patch: Partial<FormState['norm']>) => void;
  onChange: (patch: Partial<FormState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const investedCapital = investedCapitalOf(state);
  const cols = Array.from({ length: TOTAL_YEARS }, (_, i) =>
    i < HISTORY_YEARS
      ? { label: `FY${years.history[i]}`, kind: 'A', aria: `FY${years.history[i]} actual`, forecast: false }
      : { label: `FY${years.forecast[i - HISTORY_YEARS]}`, kind: 'F', aria: `FY${years.forecast[i - HISTORY_YEARS]} forecast`, forecast: true },
  );
  const sep = (i: number) => (i === HISTORY_YEARS ? 'border-l-2 border-l-[#C69C3E]' : '');

  const revenue = state.fin.rev.map((v) => num(v) ?? NaN);
  const ebitda = state.fin.ebitda.map((v) => num(v) ?? NaN);
  const complete = revenue.every((v) => v > 0) && ebitda.every(Number.isFinite);
  const chart = complete
    ? revenueMarginSeriesChart(cols.map((c) => `FY${c.label.slice(4)}`), revenue, ebitda, 760, 210)
    : null;

  const reported = ebitda[HISTORY_YEARS - 1];
  const addBacks = (num(state.norm.oneOff) ?? 0) + (num(state.norm.ownerCosts) ?? 0);
  const normActive = addBacks !== 0;

  return (
    <Panel eyebrow="Step 2 of 4">
      <PanelTitle
        title="Historical and forecast financials"
        lead="Enter actuals for the last three years and your forecast for the next five. You can type every figure, or fill the forecast from simple assumptions and then edit."
      />

      {/* Every year fits at 1280px and wider. Narrower, the table scrolls with
          the line names pinned and a thin gold scrollbar. */}
      <div
        className="pmbc-scroll-thin relative overflow-x-auto rounded-[2px] border border-[color:var(--pmbc-border-warm)]"
        tabIndex={0}
        role="region"
        aria-label="Financials table. Scrolls horizontally on smaller screens."
      >
        <table className="w-full min-w-[760px] table-fixed border-collapse tabular-nums">
          <colgroup>
            <col className="w-[136px] xl:w-[150px]" />
            {cols.map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] border-b border-[color:var(--pmbc-border-warm)] bg-[#F6F1E6] px-2 py-2 text-left text-[12.5px] font-semibold text-[color:var(--pmbc-muted)]">
                {currencyCode} millions
              </th>
              {cols.map((c, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`border-b border-[color:var(--pmbc-border-warm)] bg-[#F6F1E6] px-1 py-2 text-center text-[12.5px] font-semibold ${c.forecast ? 'text-[#A88530]' : 'text-[color:var(--pmbc-muted)]'} ${sep(i)}`}
                >
                  {c.label}
                  <span className="block text-[10.5px] font-medium">{c.forecast ? 'Forecast' : 'Actual'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINES.map((line, r) => (
              <tr key={line.k}>
                <th
                  scope="row"
                  className={`sticky left-0 z-[1] bg-white px-2 py-1.5 text-left text-[13.5px] font-medium text-[color:var(--pmbc-text)] ${r < LINES.length - 1 ? 'border-b border-[color:var(--pmbc-border-warm)]' : ''}`}
                >
                  {line.n}
                  {line.s && <small className="block text-[11.5px] font-normal text-[color:var(--pmbc-muted)]">{line.s}</small>}
                </th>
                {cols.map((c, i) => (
                  <td key={i} className={`px-1 py-1.5 ${r < LINES.length - 1 ? 'border-b border-[color:var(--pmbc-border-warm)]' : ''} ${sep(i)}`}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.1}
                      value={state.fin[line.k][i]}
                      onChange={(e) => onCell(line.k, i, e.target.value)}
                      aria-label={`${line.n} ${c.aria}`}
                      className={`w-full rounded-[2px] border px-1.5 py-1.5 text-right text-[13.5px] focus:border-[#C69C3E] focus:outline-none focus:ring-[3px] focus:ring-[#C69C3E]/25 ${
                        c.forecast ? 'border-[#EFE3C8] bg-[#FFFDF8]' : 'border-[color:var(--pmbc-border-warm)] bg-white'
                      }`}
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

      <div className="mt-3 rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-[#FDFBF7] p-4">
        <p className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-[color:var(--pmbc-muted)]">
          <span className="font-semibold text-[color:var(--pmbc-text)]">Revenue and EBITDA margin</span>
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[1px] bg-[#1B3A5F]" />Actual</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[1px] bg-[#C69C3E]" />Forecast</span>          </span>
        </p>
        {chart ? (
          <ChartSvg chart={chart} />
        ) : (
          <p className="py-8 text-center text-[13px] text-[color:var(--pmbc-muted)]">The chart appears once every year has revenue and EBITDA.</p>
        )}
      </div>

      <div className="mt-4 rounded-[2px] bg-[#FAF7F2] p-4 sm:p-5">
        <strong className="text-[15px] text-[color:var(--pmbc-text)]">Fill the forecast from assumptions</strong>
        <Hint>Applied to every forecast year. Overwrites the forecast columns only.</Hint>
        <div className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
          {FILLS.map((f) => (
            <div key={f.k} className="flex h-full flex-col justify-end">
              <label htmlFor={`fill-${f.k}`} className="mb-1 block min-h-[2.5em] text-[13px] leading-tight text-[color:var(--pmbc-text)] sm:flex sm:items-end">
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

      <Collapsible
        title="Normalise EBITDA"
        badge={normActive ? 'In use' : 'Optional'}
        summary="Add back one-off costs and owner costs above a market rate. Comparables then use normalised EBITDA."
      >
        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field label={`One-off costs in FY${years.history[HISTORY_YEARS - 1]}`} hint="Costs that will not recur, such as a lawsuit or a relocation. Never carried into the forecast.">
            {({ id, describedBy }) => (
              <NumberInput id={id} step={0.1} placeholder="0" suffix={`${currencyCode} m`} value={state.norm.oneOff} onValue={(v) => onNorm({ oneOff: v })} aria-describedby={describedBy} />
            )}
          </Field>
          <Field label="Owner costs above a market rate" hint="Salaries, rent or other costs paid to owners or related parties above what a new owner would pay.">
            {({ id, describedBy }) => (
              <NumberInput id={id} step={0.1} placeholder="0" suffix={`${currencyCode} m`} value={state.norm.ownerCosts} onValue={(v) => onNorm({ ownerCosts: v })} aria-describedby={describedBy} />
            )}
          </Field>
        </div>
        <label className="mt-1 flex items-start gap-3 text-[14px] leading-[1.5] text-[color:var(--pmbc-text)]">
          <input
            type="checkbox"
            checked={state.norm.carryOwnerCosts}
            onChange={(e) => onNorm({ carryOwnerCosts: e.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-[#1B3A5F]"
          />
          <span>Add the owner cost adjustment to every forecast year as well. Tick this if your forecast still includes those costs.</span>
        </label>
        {Number.isFinite(reported) && (
          <p className="mt-3 rounded-[2px] bg-white px-3 py-2 text-[13.5px] text-[color:var(--pmbc-text)] tabular-nums">
            Reported EBITDA {fmtMillions(reported)}, normalised <strong>{fmtMillions(reported + addBacks)}</strong> {currencyCode} m
          </p>
        )}
      </Collapsible>

      <Collapsible
        title="Invested capital"
        badge={state.icFixedAssets.trim() || state.investedCapital.trim() ? 'In use' : 'Optional'}
        summary="Working capital plus net fixed assets. Enables the return on invested capital checks against WACC and growth."
      >
        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field
            label={`Net working capital at the end of FY${years.history[HISTORY_YEARS - 1]}`}
            hint="Taken from the financials table above. Change it only if it should differ here."
          >
            {({ id, describedBy }) => (
              <NumberInput
                id={id}
                step={0.1}
                suffix={`${currencyCode} m`}
                placeholder={state.fin.nwc[HISTORY_YEARS - 1] || '0'}
                value={state.icWorkingCapital}
                onValue={(v) => onChange({ icWorkingCapital: v })}
                aria-describedby={describedBy}
              />
            )}
          </Field>
          <Field
            label={`Net fixed assets at the end of FY${years.history[HISTORY_YEARS - 1]}`}
            hint="Property, plant and equipment less depreciation, plus intangible assets used in the business. Leave blank to skip the ROIC checks."
          >
            {({ id, describedBy }) => (
              <NumberInput id={id} step={0.1} min={0} suffix={`${currencyCode} m`} value={state.icFixedAssets} onValue={(v) => onChange({ icFixedAssets: v, investedCapital: '' })} aria-describedby={describedBy} />
            )}
          </Field>
        </div>
        <p className="text-[13.5px] text-[color:var(--pmbc-text)] tabular-nums" aria-live="polite" data-invested-capital-readout="">
          {investedCapital === null
            ? 'Invested capital is working capital plus net fixed assets.'
            : `Invested capital: ${fmtMillions(investedCapital)} ${currencyCode} m (working capital plus net fixed assets).`}
        </p>
      </Collapsible>

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Continue to cost of capital" />
    </Panel>
  );
}
