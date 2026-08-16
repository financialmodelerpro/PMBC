'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * The interactive half of the testimonial section.
 *
 * Split out because the section renderer is a server component and this needs
 * state, a file input and the query string. The same split `ContactForm` uses.
 *
 * **The token comes from `?t=` on whatever page this section sits on.** That is
 * what makes a private link work without a page of its own: Ahmad sends
 * `/contact?t=abc`, the client lands on the page he chose, and the submission
 * is stamped with the link it came through.
 */
export function TestimonialFormFields({
  buttonLabel,
  successMessage,
  consentLabel,
}: {
  buttonLabel: string;
  successMessage: string;
  consentLabel: string;
}) {
  const searchParams = useSearchParams();
  const token = searchParams?.get('t') ?? '';

  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Same pair of spam signals the contact form sends: a field a person never
  // sees, and how long the form was on screen.
  const [honeypot, setHoneypot] = useState('');
  const loadedAt = useRef<number>(0);
  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setError(null);

    const body = new FormData(e.currentTarget);
    body.set('website', honeypot);
    body.set('elapsed_ms', String(loadedAt.current ? Date.now() - loadedAt.current : 0));
    body.set('consent', consent ? 'true' : 'false');
    if (token) body.set('token', token);

    try {
      const res = await fetch('/api/testimonials/submit', { method: 'POST', body });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.');
        setStatus('idle');
        return;
      }
      setStatus('sent');
      formRef.current?.reset();
      setConsent(false);
      setPhotoName(null);
    } catch {
      setError('Could not reach the server. Please try again.');
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return (
      <div className="border-l-[3px] border-[color:var(--pmbc-accent)] bg-white p-8">
        <p className="text-[16px] leading-relaxed text-[color:var(--pmbc-text)]">
          {successMessage}
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-lg border border-[color:var(--pmbc-border)] bg-white p-8 sm:p-10"
    >
      {/* Honeypot. Hidden by position rather than by display:none or
          type="hidden", both of which the well-written bots skip. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '-9999px',
          width: 1,
          height: 1,
          overflow: 'hidden',
          opacity: 0,
        }}
      >
        <label htmlFor="t-website">Website</label>
        <input
          id="t-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" required>
          <input name="name" type="text" required autoComplete="name" className={INPUT} />
        </Field>
        <Field label="Role" hint="Optional">
          <input name="role" type="text" autoComplete="organization-title" className={INPUT} />
        </Field>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Company" hint="Optional">
          <input name="company" type="text" autoComplete="organization" className={INPUT} />
        </Field>
        <Field label="LinkedIn profile" hint="Optional">
          <input
            name="linkedin_url"
            type="text"
            inputMode="url"
            placeholder="linkedin.com/in/yourname"
            className={INPUT}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Your testimonial" required>
          <textarea name="text" required rows={6} minLength={40} className={INPUT} />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Photo" hint="Optional. JPEG, PNG or WebP, under 5MB.">
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
            className="block w-full text-[14px] text-[color:var(--pmbc-muted)] file:mr-4 file:border file:border-[color:var(--pmbc-border)] file:bg-[color:var(--pmbc-surface-cream)] file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-[color:var(--pmbc-primary)]"
          />
        </Field>
        {photoName && (
          <p className="mt-2 text-[13px] text-[color:var(--pmbc-muted)]">Selected: {photoName}</p>
        )}
      </div>

      {/* Consent, unticked by default and required to submit. The
          confidentiality statement commits the firm to not publishing a
          client's involvement without agreement, so this is the record of that
          agreement rather than a formality. */}
      <label className="mt-7 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#1B3A5F]"
        />
        <span className="text-[14px] leading-relaxed text-[color:var(--pmbc-muted)]">
          {consentLabel}
        </span>
      </label>

      {error && (
        <p className="mt-5 text-[14px] text-[#B3261E]" role="alert">
          {error}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!consent || status === 'sending'}
          className="inline-flex items-center justify-center border border-[color:var(--pmbc-primary)] bg-[color:var(--pmbc-primary)] px-8 py-3.5 text-[12px] font-semibold uppercase text-white transition duration-200 hover:bg-[color:var(--pmbc-primary-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ letterSpacing: '0.12em' }}
        >
          {status === 'sending' ? 'Sending...' : buttonLabel}
        </button>
        <p className="text-[13px] leading-relaxed text-[color:var(--pmbc-muted)]">
          Nothing is published until we have reviewed it.
        </p>
      </div>
    </form>
  );
}

const INPUT =
  'block w-full border border-[color:var(--pmbc-border)] bg-white px-4 py-3 text-[15px] text-[color:var(--pmbc-text)] outline-none focus:border-[color:var(--pmbc-primary)]';

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-[color:var(--pmbc-text)]">
          {label}
          {required && <span className="text-[color:var(--pmbc-accent-muted)]"> *</span>}
        </span>
        {hint && <span className="text-[12px] text-[color:var(--pmbc-muted)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
