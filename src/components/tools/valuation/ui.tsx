'use client';

/**
 * Small presentational pieces the valuation steps share.
 *
 * Styled with the site's tokens rather than the reference's standalone sheet:
 * Source Serif 4 headings, Inter body, the warm border on white panels, and the
 * site's square-cornered navy button. Two things are kept from the reference on
 * purpose: inputs that accept numbers are blue, the modelling convention for a
 * value the user controls, and only inside this calculator.
 */

import { useId, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

export const INPUT_BLUE = '#0000FF';

export const inputClass =
  'w-full rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white px-3 py-2.5 text-[15px] text-[color:var(--pmbc-text)] transition-shadow focus:border-[#C69C3E] focus:outline-none focus:ring-[3px] focus:ring-[#C69C3E]/25 aria-[invalid=true]:border-[#B3412F]';

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 border border-[#1B3A5F] bg-[#1B3A5F] px-6 py-3 text-[12px] font-semibold uppercase text-white transition-colors duration-200 hover:border-[#C69C3E] hover:bg-[#14304F] disabled:cursor-not-allowed disabled:opacity-60';

export const buttonGhost =
  'inline-flex items-center justify-center gap-2 border border-[color:var(--pmbc-border-warm)] bg-white px-5 py-3 text-[12px] font-semibold uppercase text-[color:var(--pmbc-primary)] transition-colors duration-200 hover:border-[#C69C3E] hover:bg-[#FAF7F2]';

export const buttonSmall =
  'inline-flex items-center justify-center gap-2 border border-[color:var(--pmbc-border-warm)] bg-white px-4 py-2 text-[11px] font-semibold uppercase text-[color:var(--pmbc-primary)] transition-colors duration-200 hover:border-[#C69C3E] hover:bg-[#FAF7F2]';

export const TRACKING = { letterSpacing: '0.12em' } as const;

export function Panel({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section
      id={id}
      className="mx-auto w-full max-w-[900px] rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white px-4 py-6 sm:px-9 sm:py-9"
    >
      {children}
    </section>
  );
}

export function PanelTitle({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <>
      <h2 className="pmbc-display text-[26px] leading-[1.2] text-[color:var(--pmbc-text)] sm:text-[30px]">{title}</h2>
      {lead && <p className="mt-2 mb-6 max-w-[62ch] text-[15px] leading-[1.65] text-[#52606B]">{lead}</p>}
    </>
  );
}

export function Group({ title, sub, children, first }: { title: string; sub?: ReactNode; children: ReactNode; first?: boolean }) {
  return (
    <div className={first ? 'pb-6' : 'border-t border-[color:var(--pmbc-border-warm)] py-6'}>
      <h3 className="font-serif text-[19px] font-semibold text-[color:var(--pmbc-text)]">{title}</h3>
      {sub && <p className="mt-1 mb-4 text-[14px] text-[#52606B]">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[12.5px] leading-[1.45] text-[color:var(--pmbc-muted)]">{children}</p>;
}

export function ErrorText({ id, children }: { id?: string; children?: ReactNode }) {
  return (
    <p id={id} role={children ? 'alert' : undefined} className="mt-1 min-h-[1em] text-[13px] text-[#B3412F]">
      {children}
    </p>
  );
}

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-[color:var(--pmbc-text)]">
        {label}
      </label>
      {children({ id, describedBy: error ? errId : undefined, invalid: Boolean(error) })}
      {hint && <Hint>{hint}</Hint>}
      {error !== undefined && <ErrorText id={errId}>{error}</ErrorText>}
    </div>
  );
}

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: string;
  onValue: (v: string) => void;
  suffix?: string;
};

export function NumberInput({ value, onValue, suffix, className, ...rest }: NumberInputProps) {
  const input = (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onValue(e.target.value)}
      className={`${inputClass} tabular-nums ${suffix ? 'pr-14' : ''} ${className ?? ''}`}
      style={{ color: INPUT_BLUE }}
      {...rest}
    />
  );
  if (!suffix) return input;
  return (
    <div className="relative">
      {input}
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-[color:var(--pmbc-muted)]">
        {suffix}
      </span>
    </div>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputClass} ${className ?? ''}`} {...rest}>
      {children}
    </select>
  );
}

export function NavRow({ children }: { children: ReactNode }) {
  return <div className="mt-7 flex flex-wrap items-center justify-between gap-3">{children}</div>;
}
