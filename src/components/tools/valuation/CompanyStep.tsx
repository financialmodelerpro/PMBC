'use client';

import { COUNTRIES, INDUSTRIES, TAX } from '@/lib/tools/valuation/data';
import { PROFILE_LIMITS } from '@/lib/tools/valuation/profile';
import type { FieldErrors } from '@/lib/tools/valuation/engine';

import { SearchSelect } from './SearchSelect';
import { netDebtOf, type BridgeKey, type FormState } from './state';
import { Collapsible, Field, NumberInput, Panel, PanelTitle, StepNav, inputClass } from './ui';

const INDUSTRY_OPTIONS = Object.keys(INDUSTRIES).map((name) => ({ value: name, label: name }));
/** A million figure for the net debt line: up to one decimal, grouped. */
const millions = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

const COUNTRY_OPTIONS = Object.entries(COUNTRIES).map(([name, c]) => ({ value: name, label: name, tag: c.code }));

const BRIDGE_FIELDS: { k: BridgeKey; label: string; hint: string }[] = [
  {
    k: 'eosb',
    label: 'End of service benefits provision',
    hint: 'The accrued liability for staff gratuity, common in KSA and the GCC. Leave blank if it is already inside borrowings.',
  },
  {
    k: 'leases',
    label: 'Lease liabilities',
    hint: 'Only if not already counted in borrowings above. Entering them in both places deducts them twice.',
  },
  {
    k: 'minorityInterest',
    label: 'Minority interest',
    hint: 'The share of subsidiaries owned by others, when the figures above include 100% of those subsidiaries.',
  },
  {
    k: 'surplusAssets',
    label: 'Surplus assets and investments',
    hint: 'Assets the business does not need to operate, such as spare land or investments. Added to equity. Not cash already entered above.',
  },
];

export function CompanyStep({
  state,
  currencyCode,
  errors,
  onIndustry,
  onCountry,
  onChange,
  onBridge,
  onExample,
  onNext,
}: {
  state: FormState;
  currencyCode: string;
  errors: FieldErrors;
  onIndustry: (v: string) => void;
  onCountry: (v: string) => void;
  onChange: (patch: Partial<FormState>) => void;
  onBridge: (k: BridgeKey, v: string) => void;
  onExample: () => void;
  onNext: () => void;
}) {
  const bridgeCount = BRIDGE_FIELDS.filter((f) => state.bridge[f.k].trim() !== '').length;
  const yearEnd = /^\d{4}$/.test(state.financialYear.trim()) ? state.financialYear.trim() : 'of that year';
  const netDebt = netDebtOf(state);
  return (
    <Panel eyebrow="Step 1 of 4">
      <PanelTitle
        title="Company profile"
        lead="Amounts are entered in millions of the local currency of the country you select. GCC currencies are pegged to the US dollar, so the Damodaran cost of capital applies directly. For Pakistan, the tool converts the US dollar cost of capital into rupee terms using expected inflation."
      />
      <div className="mb-2 rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-[#FDFBF7] p-4 sm:p-5">
        <p className="mb-3 text-[13.5px] leading-[1.55] text-[#52606B]">
          Optional. Your company name and a short description make the PDF report your own. Neither changes the figures.
        </p>
        <Field label="Company name (optional)" hint="Shown on the report cover and on your results.">
          {({ id, describedBy }) => (
            <input
              id={id}
              type="text"
              autoComplete="organization"
              maxLength={PROFILE_LIMITS.companyName}
              value={state.companyName}
              onChange={(e) => onChange({ companyName: e.target.value })}
              aria-describedby={describedBy}
              className={inputClass}
            />
          )}
        </Field>
        <Field
          label="About the business (optional)"
          hint={`One or two paragraphs: what the business does, where, and for whom. ${state.description.length.toLocaleString('en-US')} of ${PROFILE_LIMITS.description.toLocaleString('en-US')} characters.`}
        >
          {({ id, describedBy }) => (
            <textarea
              id={id}
              rows={5}
              maxLength={PROFILE_LIMITS.description}
              value={state.description}
              onChange={(e) => onChange({ description: e.target.value })}
              aria-describedby={describedBy}
              className={`${inputClass} min-h-[132px] resize-y leading-[1.55]`}
            />
          )}
        </Field>
      </div>
      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field label="Industry" hint="Damodaran global industry classification. Sets beta, debt ratio and preset multiples." error={errors.industry ?? ''}>
          {({ id, describedBy, invalid }) => (
            <SearchSelect id={id} value={state.industry} options={INDUSTRY_OPTIONS} placeholder="Search industries" onChange={onIndustry} describedBy={describedBy} invalid={invalid} />
          )}
        </Field>
        <Field label="Country of operations" hint="Sets currency, country risk premium, default spread and tax rate." error={errors.country ?? ''}>
          {({ id, describedBy, invalid }) => (
            <SearchSelect id={id} value={state.country} options={COUNTRY_OPTIONS} placeholder="Search countries" onChange={onCountry} describedBy={describedBy} invalid={invalid} />
          )}
        </Field>
      </div>
      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field label="Last completed financial year" hint="The latest full year of actuals, assumed to end on 31 December. The valuation is dated today." error={errors.financialYear ?? ''}>
          {({ id, describedBy, invalid }) => (
            <NumberInput
              id={id}
              min={2015}
              max={2035}
              inputMode="numeric"
              value={state.financialYear}
              onValue={(v) => onChange({ financialYear: v })}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      </div>

      {/* Borrowings and cash, entered separately; net debt is worked out from them. */}
      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field
          label={`Borrowings at 31 December ${yearEnd}`}
          hint="Bank loans, overdrafts and other interest-bearing debt at the year end. Use 0 if none. Enter lease liabilities under Other balance sheet items."
          error={errors.debt ?? ''}
        >
          {({ id, describedBy, invalid }) => (
            <NumberInput
              id={id}
              min={0}
              step={0.1}
              placeholder="0"
              suffix={`${currencyCode} m`}
              value={state.debt}
              onValue={(v) => onChange({ debt: v })}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field
          label={`Cash at 31 December ${yearEnd}`}
          hint={
            state.country === TAX.zakatCountry
              ? 'Cash and bank balances at the year end. Use 0 if none. Also adds to the zakat base.'
              : 'Cash and bank balances at the year end. Use 0 if none.'
          }
          error={errors.cash ?? ''}
        >
          {({ id, describedBy, invalid }) => (
            <NumberInput
              id={id}
              min={0}
              step={0.1}
              placeholder="0"
              suffix={`${currencyCode} m`}
              value={state.cash}
              onValue={(v) => onChange({ cash: v })}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      </div>
      <p className="-mt-1 mb-5 text-[13px] leading-[1.5] text-[#52606B]" aria-live="polite" data-net-debt-readout="">
        {netDebt === null
          ? 'Net debt is borrowings less cash. The valuation rolls it forward to today using the cash flow since.'
          : netDebt >= 0
            ? `Net debt: ${millions(netDebt)} ${currencyCode} m (borrowings less cash). The valuation rolls it forward to today using the cash flow since.`
            : `Net cash: ${millions(-netDebt)} ${currencyCode} m (cash above borrowings). The valuation rolls it forward to today using the cash flow since.`}
      </p>

      {state.country === TAX.zakatCountry && (
        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field
            label="Saudi / GCC ownership %"
            hint={`Required. Share of the company owned by Saudi or GCC nationals, 0 to 100. Zakat of ${TAX.zakatRate}% of the zakat base applies to that share, corporate income tax to the rest.`}
            error={errors.gccOwnership ?? ''}
          >
            {({ id, describedBy, invalid }) => (
              <NumberInput
                id={id}
                min={0}
                max={100}
                step={1}
                suffix="%"
                value={state.gccOwnership}
                onValue={(v) => onChange({ gccOwnership: v })}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
        </div>
      )}

      <Collapsible
        title="Other balance sheet items"
        badge={bridgeCount ? `${bridgeCount} entered` : 'Optional'}
        summary="End of service benefits, leases, minority interest and surplus assets, between enterprise value and equity."
      >
        <div className="grid gap-x-5 sm:grid-cols-2">
          {BRIDGE_FIELDS.map((f) => (
            <Field key={f.k} label={f.label} hint={f.hint} error={errors[f.k] ?? undefined}>
              {({ id, describedBy, invalid }) => (
                <NumberInput
                  id={id}
                  step={0.1}
                  min={0}
                  placeholder="0"
                  suffix={`${currencyCode} m`}
                  value={state.bridge[f.k]}
                  onValue={(v) => onBridge(f.k, v)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>
          ))}
        </div>
      </Collapsible>

      <StepNav
        onNext={onNext}
        nextLabel="Continue to financials"
        extra={
          <button
            type="button"
            onClick={onExample}
            className="text-[14px] text-[color:var(--pmbc-muted)] underline underline-offset-4 hover:text-[color:var(--pmbc-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50"
          >
            Load an example company
          </button>
        }
      />
    </Panel>
  );
}
