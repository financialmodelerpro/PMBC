'use client';

import { WACC_SOURCE_SENTENCE } from '@/lib/tools/valuation/data';
import type { Currency, WaccBreakdown } from '@/lib/tools/valuation/engine';
import { fmtPct } from '@/lib/tools/valuation/format';

import type { FormState, WaccKey } from './state';
import { Field, Group, Hint, NumberInput, Panel, PanelTitle, StepNav, TRACKING, buttonGhost } from './ui';

type Spec = { k: WaccKey; label: string; hint: string; step: number; suffix?: string };

const EQUITY: Spec[] = [
  { k: 'rf', label: 'Risk-free rate', hint: 'US 10-year Treasury less US default spread', step: 0.01, suffix: '%' },
  { k: 'erp', label: 'Mature market equity risk premium', hint: 'Damodaran implied premium', step: 0.01, suffix: '%' },
  { k: 'crp', label: 'Country risk premium', hint: '', step: 0.01, suffix: '%' },
  { k: 'bu', label: 'Unlevered beta', hint: '', step: 0.01 },
  { k: 'de', label: 'Target debt to equity', hint: 'Industry average market D/E', step: 1, suffix: '%' },
  {
    k: 'sp',
    label: 'Size and company premium',
    hint: 'For private company and size risk. Set by revenue, adjust for your view.',
    step: 0.1,
    suffix: '%',
  },
];

const DEBT: Spec[] = [
  { k: 'ds', label: 'Country default spread', hint: 'From sovereign rating', step: 0.01, suffix: '%' },
  { k: 'cs', label: 'Company credit spread', hint: 'Your borrowing margin over the base rate', step: 0.1, suffix: '%' },
  {
    k: 'tax',
    label: 'Corporate income tax rate',
    hint: 'Marginal corporate rate. In Saudi Arabia zakat is blended in from the ownership share on step 1.',
    step: 0.5,
    suffix: '%',
  },
];

export function WaccStep({
  state,
  currency,
  wacc,
  onWacc,
  onReset,
  onBack,
  onNext,
}: {
  state: FormState;
  currency: Currency;
  wacc: WaccBreakdown;
  onWacc: (k: WaccKey, v: string) => void;
  onReset: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const hintFor = (s: Spec) =>
    s.k === 'crp' && state.country
      ? `Damodaran, ${state.country}`
      : s.k === 'bu' && state.industry
        ? `Damodaran global, ${state.industry}`
        : s.hint;

  const renderSpec = (s: Spec) => (
    <Field key={s.k} label={s.label} hint={hintFor(s) || undefined}>
      {({ id }) => <NumberInput id={id} step={s.step} suffix={s.suffix} value={state.wacc[s.k]} onValue={(v) => onWacc(s.k, v)} />}
    </Field>
  );

  const bl = Number.isFinite(wacc.bl) ? wacc.bl.toFixed(2) : 'n/a';
  const outRows: [string, string][] = [
    ['Levered beta', bl],
    ['Cost of equity', fmtPct(wacc.ke)],
    ['Pre-tax cost of debt', fmtPct(wacc.kd)],
    ...(wacc.cit !== undefined && Number.isFinite(wacc.t) && wacc.t !== wacc.cit ? ([['Tax rate used, after Saudi / GCC ownership', fmtPct(wacc.t)]] as [string, string][]) : []),
    ['After-tax cost of debt', fmtPct(wacc.kdt)],
    ['Equity weight', fmtPct(wacc.we, 1)],
    ['Debt weight', fmtPct(wacc.wd, 1)],
  ];

  return (
    <Panel eyebrow="Step 3 of 4">
      <PanelTitle
        title="Cost of capital"
        lead="Prefilled from Damodaran data for your industry and country. Every input can be changed. WACC updates as you type."
      />

      <Group title="Cost of equity" first>
        <div className="grid gap-x-5 sm:grid-cols-3">{EQUITY.map(renderSpec)}</div>
      </Group>

      <Group title="Cost of debt and tax">
        <div className="grid gap-x-5 sm:grid-cols-3">{DEBT.map(renderSpec)}</div>
      </Group>

      {!currency.pegged && (
        <Group
          title="Currency conversion"
          sub={`${currency.code} is not pegged to the US dollar. The Damodaran inputs give a US dollar WACC, which is converted to ${currency.code} using the expected inflation gap. Enter forecasts and growth in nominal ${currency.code}.`}
        >
          <div className="grid gap-x-5 sm:grid-cols-3">
            <Field label="Expected local inflation" hint="Long-term expectation, not the current rate">
              {({ id }) => (
                <NumberInput id={id} step={0.1} suffix="%" value={state.wacc.inflationLocal} onValue={(v) => onWacc('inflationLocal', v)} />
              )}
            </Field>
            <Field label="Expected US inflation" hint="Long-term expectation">
              {({ id }) => (
                <NumberInput id={id} step={0.1} suffix="%" value={state.wacc.inflationUs} onValue={(v) => onWacc('inflationUs', v)} />
              )}
            </Field>
            <div className="mb-3.5">
              <p className="mb-1.5 text-[14px] font-medium text-[color:var(--pmbc-text)]">Method</p>
              <Hint>Local WACC = (1 + USD WACC) x (1 + local inflation) / (1 + US inflation) less 1</Hint>
            </div>
          </div>
        </Group>
      )}

      <div className="mt-2 rounded-[2px] bg-[#1B3A5F] p-5 text-white sm:p-6" aria-live="polite">
        <dl className="grid gap-x-7 sm:grid-cols-2">
          {outRows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-[#E8DDC4]/20 py-1.5 text-[14.5px]">
              <dt className="text-[#E8DDC4]">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
          {!currency.pegged && (
            <div className="flex justify-between border-b border-[#E8DDC4]/20 py-1.5 text-[14.5px]">
              <dt className="text-[#E8DDC4]">WACC in US dollars</dt>
              <dd className="tabular-nums">{fmtPct(wacc.waccUsd)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[15px] text-[#E8DDC4]">Weighted average cost of capital, {currency.code}</span>
          <b className="pmbc-display text-[36px] text-[#C69C3E]">{fmtPct(wacc.wacc)}</b>
        </div>
      </div>
      <p className="mt-3.5 text-[12.5px] leading-[1.5] text-[color:var(--pmbc-muted)]">{WACC_SOURCE_SENTENCE}</p>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue to terminal and comps"
        extra={
          <button type="button" onClick={onReset} className={buttonGhost} style={TRACKING}>
            Reset to Damodaran defaults
          </button>
        }
      />
    </Panel>
  );
}
