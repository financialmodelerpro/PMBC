'use client';

import { COUNTRIES, INDUSTRIES } from '@/lib/tools/valuation/data';
import type { FieldErrors } from '@/lib/tools/valuation/engine';

import type { FormState } from './state';
import { Field, NavRow, NumberInput, Panel, PanelTitle, Select, TRACKING, buttonPrimary } from './ui';

export function CompanyStep({
  state,
  currencyCode,
  errors,
  onIndustry,
  onCountry,
  onChange,
  onExample,
  onNext,
}: {
  state: FormState;
  currencyCode: string;
  errors: FieldErrors;
  onIndustry: (v: string) => void;
  onCountry: (v: string) => void;
  onChange: (patch: Partial<FormState>) => void;
  onExample: () => void;
  onNext: () => void;
}) {
  return (
    <Panel>
      <PanelTitle
        title="Company profile"
        lead="Amounts are entered in millions of the local currency of the country you select. GCC currencies are pegged to the US dollar, so the Damodaran cost of capital applies directly. For Pakistan, the tool converts the US dollar cost of capital into rupee terms using expected inflation."
      />
      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field
          label="Industry"
          hint="Damodaran global industry classification. Sets beta, debt ratio and preset multiples."
          error={errors.industry ?? ''}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              value={state.industry}
              onChange={(e) => onIndustry(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            >
              <option value="">Select an industry</option>
              {Object.keys(INDUSTRIES).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Country of operations"
          hint="Sets country risk premium, default spread and tax rate."
          error={errors.country ?? ''}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              value={state.country}
              onChange={(e) => onCountry(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            >
              <option value="">Select a country</option>
              {Object.keys(COUNTRIES).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field
          label="Last completed financial year"
          hint="Valuation date is taken as the end of this year."
          error={errors.financialYear ?? ''}
        >
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
        <Field
          label="Net debt at valuation date"
          hint="Borrowings and leases less cash. Negative if cash is higher."
          error={errors.netDebt ?? ''}
        >
          {({ id, describedBy, invalid }) => (
            <NumberInput
              id={id}
              step={0.1}
              placeholder="0"
              suffix={`${currencyCode} m`}
              value={state.netDebt}
              onValue={(v) => onChange({ netDebt: v })}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      </div>
      <NavRow>
        <button
          type="button"
          onClick={onExample}
          className="text-[14px] text-[color:var(--pmbc-muted)] underline underline-offset-4 hover:text-[color:var(--pmbc-primary)]"
        >
          Load an example company
        </button>
        <button type="button" onClick={onNext} className={buttonPrimary} style={TRACKING}>
          Continue to financials
        </button>
      </NavRow>
    </Panel>
  );
}
