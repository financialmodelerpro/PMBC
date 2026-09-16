'use client';

/**
 * Small presentational pieces the valuation steps share.
 *
 * Site tokens throughout: Source Serif 4 headings, Inter body, warm borders on
 * white cards over the cream page, the square-cornered navy button, and gold
 * used for accents rather than fills. Inputs that accept numbers are blue, the
 * modelling convention for a value the user controls, inside this tool only.
 */

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';

export const INPUT_BLUE = '#0000FF';

export const inputClass =
  'w-full rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white px-3 py-2.5 text-[15px] text-[color:var(--pmbc-text)] transition-shadow focus:border-[#C69C3E] focus:outline-none focus:ring-[3px] focus:ring-[#C69C3E]/25 aria-[invalid=true]:border-[#B3412F]';

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 border border-[#1B3A5F] bg-[#1B3A5F] px-6 py-3 text-[12px] font-semibold uppercase text-white transition-colors duration-200 hover:border-[#C69C3E] hover:bg-[#14304F] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50 disabled:cursor-not-allowed disabled:opacity-60';

export const buttonGhost =
  'inline-flex items-center justify-center gap-2 border border-[color:var(--pmbc-border-warm)] bg-white px-5 py-3 text-[12px] font-semibold uppercase text-[color:var(--pmbc-primary)] transition-colors duration-200 hover:border-[#C69C3E] hover:bg-[#FAF7F2] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50 disabled:cursor-not-allowed disabled:opacity-60';

export const buttonGold =
  'inline-flex items-center justify-center gap-2 border border-[#C69C3E] bg-[#C69C3E] px-6 py-3 text-[12px] font-semibold uppercase text-[#14304F] transition-colors duration-200 hover:bg-[#A88530] hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50 disabled:cursor-not-allowed disabled:opacity-60';

export const buttonSmall =
  'inline-flex items-center justify-center gap-2 border border-[color:var(--pmbc-border-warm)] bg-white px-4 py-2 text-[11px] font-semibold uppercase text-[color:var(--pmbc-primary)] transition-colors duration-200 hover:border-[#C69C3E] hover:bg-[#FAF7F2] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50';

export const TRACKING = { letterSpacing: '0.12em' } as const;

/** A step's card: white, warm border, a gold rule and an eyebrow above the title. */
export function Panel({ id, eyebrow, children }: { id?: string; eyebrow?: string; children: ReactNode }) {
  return (
    <section id={id} className="pmbc-enter relative w-full rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white px-4 py-6 shadow-[0_1px_0_rgba(20,48,79,0.04)] sm:px-8 sm:py-8">
      <span aria-hidden className="absolute top-0 left-0 h-[3px] w-16 bg-[#C69C3E]" />
      {eyebrow && (
        <p className="mb-2 text-[11px] font-semibold uppercase text-[#A88530]" style={{ letterSpacing: '0.16em' }}>
          {eyebrow}
        </p>
      )}
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
      {sub && <p className="mt-1 mb-4 text-[14px] leading-[1.55] text-[#52606B]">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  );
}

/**
 * An optional section, closed until opened. `summary` says what it holds when
 * closed, so a visitor can tell whether they need it without opening it.
 */
export function Collapsible({
  title,
  summary,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="mt-6 rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-[#FDFBF7]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#C69C3E]/50 sm:px-5"
      >
        <span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-[17px] font-semibold text-[color:var(--pmbc-text)]">{title}</span>
            {badge && (
              <span className="rounded-[2px] bg-[#F6F1E6] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase text-[#A88530]" style={{ letterSpacing: '0.1em' }}>
                {badge}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[13.5px] text-[#52606B]">{summary}</span>
        </span>
        <ChevronDown aria-hidden size={18} className={`shrink-0 text-[#A88530] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="border-t border-[color:var(--pmbc-border-warm)] px-4 py-5 sm:px-5">
          {children}
        </div>
      )}
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
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-[color:var(--pmbc-text)]">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <div id={hintId}>
          <Hint>{hint}</Hint>
        </div>
      )}
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
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-[color:var(--pmbc-muted)]">{suffix}</span>
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

/** Back on the left, the way on on the right, with any extra actions between. */
export function StepNav({
  onBack,
  backLabel = 'Back',
  onNext,
  nextLabel,
  nextType = 'button',
  nextDisabled,
  extra,
}: {
  onBack?: () => void;
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextType?: 'button' | 'submit';
  nextDisabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--pmbc-border-warm)] pt-6">
      {onBack ? (
        <button type="button" onClick={onBack} className={buttonGhost} style={TRACKING}>
          <ArrowLeft aria-hidden size={14} />
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {extra}
        {nextLabel && (
          <button type={nextType} onClick={onNext} disabled={nextDisabled} className={buttonPrimary} style={TRACKING}>
            {nextLabel}
            <ArrowRight aria-hidden size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Kept for any caller from version 1. */
export function NavRow({ children }: { children: ReactNode }) {
  return <div className="mt-7 flex flex-wrap items-center justify-between gap-3">{children}</div>;
}
