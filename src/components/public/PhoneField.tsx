'use client';

import type { InputHTMLAttributes } from 'react';

import { CountryCombobox } from './CountryCombobox';

/**
 * The phone field, one component for every form that asks for a number: the contact form and the
 * free tools' name and email step (since 2026-09-21). Two controls, one value, stacked rather than
 * side by side. The combobox shows the country name next to the dial code, which is what makes the
 * list's order legible, and that does not fit beside a number field in half a form row without
 * truncating one of them. Join the two with `composePhone` on submit.
 */

export const PHONE_INPUT_CLASS =
  'block w-full rounded-md border border-[color:var(--pmbc-border)] bg-white px-3.5 py-2.5 text-[14px] text-[color:var(--pmbc-text)] placeholder:text-[color:var(--pmbc-muted)]/70 outline-none transition focus:border-[color:var(--pmbc-primary)] focus:ring-2 focus:ring-[color:var(--pmbc-primary)]/15';

export function PhoneField({
  country,
  onCountryChange,
  numberProps,
  inputClassName = PHONE_INPUT_CLASS,
}: {
  /** ISO code of the dialling country. */
  country: string;
  onCountryChange: (code: string) => void;
  /** The number box's props: `register('phone')` on the contact form, value and onChange elsewhere. */
  numberProps: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> };
  /** Both boxes' look. Defaults to the contact form's; another form passes its own field style. */
  inputClassName?: string;
}) {
  return (
    <div className="grid gap-2">
      <CountryCombobox value={country} onChange={onCountryChange} ariaLabel="Phone country code" inputClassName={inputClassName} />
      <input
        type="tel"
        // A visible label wrapping both controls attaches to the first one, the combobox, which then
        // overrides it with its own aria-label. That leaves the number box unnamed unless it names itself.
        aria-label="Phone number"
        autoComplete="tel-national"
        placeholder="5X XXX XXXX"
        className={inputClassName}
        {...numberProps}
      />
    </div>
  );
}
