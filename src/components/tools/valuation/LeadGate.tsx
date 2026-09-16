'use client';

import Link from 'next/link';

import { CONSENT_TEXT, FOLLOW_UP_TEXT } from '@/lib/tools/consent';
import { DEAL_BAND_UNSURE, PURPOSES } from '@/lib/tools/valuation/data';

import { Field, Panel, PanelTitle, Select, StepNav, inputClass } from './ui';

export type GateValues = {
  name: string;
  email: string;
  company: string;
  purpose: string;
  dealSize: string;
  consent: boolean;
  followUp: boolean;
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
  website: '',
};

export type GateErrors = Partial<Record<'name' | 'email' | 'purpose' | 'dealSize' | 'consent', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateGate(g: GateValues): GateErrors {
  const e: GateErrors = {};
  if (g.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!EMAIL_RE.test(g.email.trim())) e.email = 'Enter a valid email address, for example name@company.com.';
  if (!g.purpose) e.purpose = 'Select what the valuation is for.';
  if (!g.dealSize) e.dealSize = 'Select a transaction size range.';
  if (!g.consent) e.consent = 'Tick the box to agree before we show your results.';
  return e;
}

export function LeadGate({
  values,
  errors,
  dealBands,
  submitting,
  onChange,
  onBack,
  onSubmit,
}: {
  values: GateValues;
  errors: GateErrors;
  dealBands: { value: string; label: string }[];
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
          <Field label="Company (optional)">
            {({ id }) => (
              <input
                id={id}
                type="text"
                autoComplete="organization"
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
                className="mt-1 h-4 w-4 shrink-0 accent-[#1B3A5F]"
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
              className="mt-1 h-4 w-4 shrink-0 accent-[#1B3A5F]"
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
