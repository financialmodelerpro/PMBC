'use client';

import Link from 'next/link';

import { CONSENT_TEXT, FOLLOW_UP_TEXT } from '@/lib/tools/consent';
import { DEAL_BAND_UNSURE, PURPOSES } from '@/lib/tools/valuation/data';
import { LIMITS } from '@/lib/tools/valuation/limits';
import { PhoneField } from '@/components/public/PhoneField';
import { DEFAULT_DIAL_COUNTRY } from '@/lib/public/countries';
import { CONTACT_COUNTRIES, isoForContactCountry } from '@/lib/tools/contactCountries';

import { Field, NumberInput, Panel, PanelTitle, Select, StepNav, inputClass } from './ui';

export type GateValues = {
  name: string;
  email: string;
  company: string;
  purpose: string;
  dealSize: string;
  consent: boolean;
  followUp: boolean;
  /** Optional, and only asked when raising equity. Millions of the local currency. */
  raiseAmount: string;
  /** The person's own country (2026-09-21). It sets the phone's country. Optional. */
  contactCountry: string;
  /** ISO code of the phone's dialling country, as on the contact form. */
  phoneCountry: string;
  /** The number as typed. Optional. Joined with its country by composePhone on submit. */
  phone: string;
  /** Honeypot. A person never sees it. */
  website: string;
};

export const EMPTY_GATE: GateValues = {
  name: '',
  email: '',
  company: '',
  purpose: '',
  dealSize: '',
  consent: false,
  followUp: false,
  raiseAmount: '',
  contactCountry: '',
  phoneCountry: DEFAULT_DIAL_COUNTRY,
  phone: '',
  website: '',
};

export type GateErrors = Partial<Record<'name' | 'email' | 'purpose' | 'dealSize' | 'consent' | 'raiseAmount', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateGate(g: GateValues): GateErrors {
  const e: GateErrors = {};
  if (g.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!EMAIL_RE.test(g.email.trim())) e.email = 'Enter a valid email address, for example name@company.com.';
  if (!g.purpose) e.purpose = 'Select what the valuation is for.';
  if (!g.dealSize) e.dealSize = 'Select a transaction size range.';
  if (!g.consent) e.consent = 'Tick the box to agree before we show your results.';
  if (g.purpose === 'raise' && g.raiseAmount.trim() !== '' && !(parseFloat(g.raiseAmount) >= 0)) {
    e.raiseAmount = 'Enter the amount to raise as a positive number, or leave it blank.';
  }
  return e;
}

export function LeadGate({
  values,
  errors,
  dealBands,
  currencyCode,
  submitting,
  onChange,
  onBack,
  onSubmit,
}: {
  values: GateValues;
  errors: GateErrors;
  dealBands: { value: string; label: string }[];
  currencyCode: string;
  submitting: boolean;
  onChange: (patch: Partial<GateValues>) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <Panel eyebrow="Your results are ready">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <PanelTitle
          title="Your valuation is ready"
          lead="Tell us where to send your results. You will see the full DCF, comparables and sensitivity on the next screen."
        />

        {/* Honeypot. Positioned off screen rather than display:none, which
            some form fillers skip, and kept out of the tab order and the
            accessibility tree so no person can reach it. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="tool-website">Website</label>
          <input
            id="tool-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => onChange({ website: e.target.value })}
          />
        </div>

        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field label="Full name" error={errors.name ?? ''}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                type="text"
                autoComplete="name"
                maxLength={LIMITS.gateName}
                value={values.name}
                onChange={(e) => onChange({ name: e.target.value })}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Work email" error={errors.email ?? ''}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                type="email"
                autoComplete="email"
                maxLength={LIMITS.gateEmail}
                value={values.email}
                onChange={(e) => onChange({ email: e.target.value })}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className={inputClass}
              />
            )}
          </Field>
        </div>
        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field label="Your country (optional)">
            {({ id }) => (
              <Select
                id={id}
                autoComplete="country-name"
                value={values.contactCountry}
                onChange={(e) => {
                  const country = e.target.value;
                  // The phone's country follows, unless the country is not in the phone list ("Other").
                  const iso = isoForContactCountry(country);
                  onChange({ contactCountry: country, phoneCountry: iso || values.phoneCountry });
                }}
              >
                <option value="">Select</option>
                {CONTACT_COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Phone number (optional)">
            {({ id }) => (
              <PhoneField
                country={values.phoneCountry || DEFAULT_DIAL_COUNTRY}
                onCountryChange={(code) => onChange({ phoneCountry: code })}
                // The contact form's component, in this form's field style.
                inputClassName={inputClass}
                numberProps={{ id, maxLength: 40, value: values.phone, onChange: (e) => onChange({ phone: e.target.value }) }}
              />
            )}
          </Field>
        </div>
        <div className="grid gap-x-5 sm:grid-cols-2">
          <Field label="Company (optional)">
            {({ id }) => (
              <input
                id={id}
                type="text"
                autoComplete="organization"
                maxLength={LIMITS.gateCompany}
                value={values.company}
                onChange={(e) => onChange({ company: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="What is the valuation for?" error={errors.purpose ?? ''}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                value={values.purpose}
                onChange={(e) => onChange({ purpose: e.target.value })}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              >
                <option value="">Select a purpose</option>
                {PURPOSES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {values.purpose === 'raise' && (
          <Field
            label="Amount you plan to raise (optional)"
            hint="Adds pre-money and post-money values to your report. Leave blank and the values shown are pre-money."
            error={errors.raiseAmount ?? ''}
          >
            {({ id, describedBy, invalid }) => (
              <NumberInput
                id={id}
                min={0}
                step={0.1}
                suffix={`${currencyCode} m`}
                value={values.raiseAmount}
                onValue={(v) => onChange({ raiseAmount: v })}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
        )}
        <Field label="Planned transaction size" error={errors.dealSize ?? ''}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              value={values.dealSize}
              onChange={(e) => onChange({ dealSize: e.target.value })}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            >
              <option value="">Select a range</option>
              {dealBands.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
              <option value={DEAL_BAND_UNSURE}>Not decided yet</option>
            </Select>
          )}
        </Field>

        <div className="mt-2 space-y-3">
          <div>
            <label className="flex items-start gap-3 text-[14px] leading-[1.55] text-[color:var(--pmbc-text)]">
              <input
                type="checkbox"
                checked={values.consent}
                onChange={(e) => onChange({ consent: e.target.checked })}
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={errors.consent ? 'tool-consent-err' : undefined}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#1B3A5F]"
              />
              <span>
                {CONSENT_TEXT.replace(/privacy policy.$/, '')}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-[color:var(--pmbc-primary)]">
                  privacy policy
                </Link>
                .
              </span>
            </label>
            {errors.consent && (
              <p id="tool-consent-err" role="alert" className="mt-1 ml-7 text-[13px] text-[#B3412F]">
                {errors.consent}
              </p>
            )}
          </div>
          <label className="flex items-start gap-3 text-[14px] leading-[1.55] text-[color:var(--pmbc-muted)]">
            <input
              type="checkbox"
              checked={values.followUp}
              onChange={(e) => onChange({ followUp: e.target.checked })}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#1B3A5F]"
            />
            <span>{FOLLOW_UP_TEXT}</span>
          </label>
        </div>

        <StepNav
          onBack={onBack}
          backLabel="Back to inputs"
          nextType="submit"
          nextLabel={submitting ? 'Preparing your results' : 'Show my valuation'}
          nextDisabled={submitting}
        />
      </form>
    </Panel>
  );
}
