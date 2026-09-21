'use client';

import { ASSUMPTIONS, LENDING_RATES, WACC_SOURCE_SENTENCE, formatDataDate, type LendingRate } from '@/lib/tools/valuation/data';
import type { Currency, WaccBreakdown } from '@/lib/tools/valuation/engine';
import { fmtPct, waccSteps } from '@/lib/tools/valuation/format';

import type { FormState, WaccKey } from './state';
import { ErrorText, Field, Group, Hint, NumberInput, Panel, PanelTitle, StepNav, TRACKING, buttonGhost } from './ui';

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
  {
    k: 'kd',
    label: 'Pre-tax cost of debt',
    hint: 'What the company pays on its borrowings. Clear it to build it from the spreads instead.',
    step: 0.1,
    suffix: '%',
  },
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
  error = '',
  adjustment = 0,
  onClearAdjustment,
  onWacc,
  onReset,
  onBack,
  onNext,
}: {
  state: FormState;
  currency: Currency;
  wacc: WaccBreakdown;
  /** The step's validation message, for example a borrowing rate out of range. */
  error?: string;
  /** Points added by the results page slider in an emailed version. Included in `wacc`. */
  adjustment?: number;
  onClearAdjustment?: () => void;
  onWacc: (k: WaccKey, v: string) => void;
  onReset: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const kdEntered = state.wacc.kd.trim() !== '';
  // The default's source: the country's lending base rate, its date and source, plus the typical margin.
  const kdHint = () => {
    const l = (LENDING_RATES as Record<string, LendingRate | undefined>)[state.country];
    return l
      ? `Set from the ${l.name}, ${l.rate.toFixed(2)}% as at ${formatDataDate(l.asOf)} (${l.source}), plus a ${ASSUMPTIONS.companyCreditSpread.toFixed(1)}% margin set by PaceMakers. In ${currency.code}. Change it to your own borrowing rate, or clear it to build it from the spreads.`
      : `What the company pays on its borrowings, in ${currency.code}. Clear it to build it from the spreads.`;
  };
  const hintFor = (s: Spec) =>
    (s.k === 'ds' || s.k === 'cs') && kdEntered
      ? 'Not used while a cost of debt is set.'
      : s.k === 'kd'
        ? kdHint()
        : s.k === 'crp' && state.country
      ? `Damodaran, ${state.country}`
      : s.k === 'bu' && state.industry
        ? `Damodaran global, ${state.industry}`
        : s.hint;

  const renderSpec = (s: Spec) => (
    <Field key={s.k} label={s.label} hint={hintFor(s) || undefined}>
      {({ id }) => <NumberInput id={id} step={s.step} suffix={s.suffix} value={state.wacc[s.k]} onValue={(v) => onWacc(s.k, v)} />}
    </Field>
  );

  // The working, line by line. The final WACC is the large figure below it, so it is left out here.
  const all = Number.isFinite(wacc.wacc) ? waccSteps(wacc, currency) : [];
  const finalKey = currency.pegged ? 'wacc_base' : 'wacc_local';
  const final = all.find((x) => x.key === finalKey);
  const steps = all.filter((x) => x.key !== finalKey && x.key !== 'wacc_adjusted');
  const taxNote =
    wacc.cit !== undefined && Number.isFinite(wacc.t) && wacc.t !== wacc.cit
      ? `Tax rate used: ${fmtPct(wacc.t, 1)}, income tax on the non-GCC share only. Zakat is not a tax on profit, so it gives no interest shield.`
      : null;

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

      <ErrorText>{error}</ErrorText>
      <div className="mt-2 rounded-[2px] bg-[#1B3A5F] p-5 text-white sm:p-6" aria-live="polite">
        <p className="text-[11px] font-semibold uppercase text-[#C69C3E]" style={{ letterSpacing: '0.14em' }}>
          How your WACC is calculated
        </p>
        {!currency.pegged && (
          <p className="mt-1.5 text-[13px] leading-[1.5] text-[#E8DDC4]">
            The Damodaran inputs are US dollar rates, so the build runs in US dollars and the last line converts it to {currency.code}.
          </p>
        )}
        <dl className="mt-2">
          {steps.map((x) => (
            <div key={x.key} className="flex items-start justify-between gap-4 border-b border-[#E8DDC4]/20 py-2 text-[14.5px]">
              <dt className="min-w-0">
                <span className={x.strong ? 'font-semibold text-white' : 'text-[#E8DDC4]'}>{x.label}</span>
                <span className="block text-[12.5px] leading-[1.45] text-[#E8DDC4]/80">{x.formula}</span>
                <span className="block text-[12.5px] leading-[1.45] tabular-nums text-[#E8DDC4]/80">= {x.working}</span>
              </dt>
              <dd className={`shrink-0 tabular-nums ${x.strong ? 'font-semibold' : ''}`}>{x.value}</dd>
            </div>
          ))}
        </dl>
        {taxNote && <p className="mt-2 text-[12.5px] leading-[1.45] text-[#E8DDC4]/80">{taxNote}</p>}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[15px] text-[#E8DDC4]">Weighted average cost of capital, {currency.code}</span>
          <b className="pmbc-display text-[36px] text-[#C69C3E]">{fmtPct(wacc.wacc)}</b>
        </div>
        {final && (
          <p className="mt-1 text-[12.5px] leading-[1.45] tabular-nums text-[#E8DDC4]/80">
            {final.formula}
            <br />= {final.working}
            {adjustment !== 0 ? ` = ${final.value}, before the adjustment below` : ''}
          </p>
        )}
        {adjustment !== 0 && (
          <p className="mt-2 text-[13.5px] text-[#E8DDC4]">
            Includes a {adjustment > 0 ? '+' : ''}
            {adjustment} point adjustment from the version you emailed.{' '}
            {onClearAdjustment && (
              <button type="button" onClick={onClearAdjustment} className="underline underline-offset-2 hover:text-white">
                Remove it
              </button>
            )}
          </p>
        )}
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
