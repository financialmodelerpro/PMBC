'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import HCaptcha from '@hcaptcha/react-hcaptcha';

import {
  COUNTRIES,
  DEFAULT_DIAL_COUNTRY,
  PINNED_COUNTRIES,
  composePhone,
} from '@/lib/public/countries';
import { CountryCombobox } from './CountryCombobox';

type Service = { slug: string; title: string };

type FormValues = {
  name: string;
  email: string;
  company?: string;
  /** The locally-typed part only. Joined to the dial code on submit. */
  phone?: string;
  /** ISO code of the dialling country, never sent on its own. */
  phone_country?: string;
  country?: string;
  service_interest?: string;
  message: string;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function ContactForm({
  services,
  hcaptchaSiteKey,
  defaultServiceTitle,
}: {
  services: Service[];
  hcaptchaSiteKey: string | null;
  defaultServiceTitle?: string;
}) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      phone_country: DEFAULT_DIAL_COUNTRY,
      ...(defaultServiceTitle ? { service_interest: defaultServiceTitle } : {}),
    },
  });

  // The combobox is not a native input, so its value is held in form state
  // rather than registered. Watched so the control re-renders on selection.
  const phoneCountry = watch('phone_country');

  // Allow another submission after success message has been shown for a while.
  useEffect(() => {
    if (status.kind !== 'success') return;
    const t = setTimeout(() => setStatus({ kind: 'idle' }), 12000);
    return () => clearTimeout(t);
  }, [status]);

  const onSubmit = async (values: FormValues) => {
    if (hcaptchaSiteKey && !captchaToken) {
      setStatus({ kind: 'error', message: 'Please complete the captcha.' });
      return;
    }

    setStatus({ kind: 'submitting' });

    // The dial code and the typed digits are two controls but one fact, so they
    // are joined here and the number is stored in full international form. The
    // ISO code itself is not sent: it is how the visitor picked a prefix, not
    // something the inbox needs a column for.
    const { phone_country, phone, ...rest } = values;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          phone: composePhone(phone_country ?? DEFAULT_DIAL_COUNTRY, phone ?? ''),
          source_page: pathname,
          hcaptcha_token: captchaToken ?? undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !json.ok) {
        setStatus({ kind: 'error', message: json.error || 'Something went wrong.' });
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
        return;
      }
      setStatus({ kind: 'success' });
      reset();
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={errors.name?.message} required>
          <input
            type="text"
            autoComplete="name"
            className={inputCls}
            {...register('name', { required: 'Please share your name' })}
          />
        </Field>
        <Field label="Email" error={errors.email?.message} required>
          <input
            type="email"
            autoComplete="email"
            className={inputCls}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email',
              },
            })}
          />
        </Field>
        <Field label="Company">
          <input
            type="text"
            autoComplete="organization"
            className={inputCls}
            {...register('company')}
          />
        </Field>
        <Field label="Phone">
          {/* Two controls, one value, stacked rather than side by side. The
              combobox shows the country name next to the dial code, which is
              what makes the list's order legible, and that does not fit beside
              a number field in half a form row without truncating one of them. */}
          <div className="grid gap-2">
            <CountryCombobox
              value={phoneCountry || DEFAULT_DIAL_COUNTRY}
              onChange={(code) =>
                setValue('phone_country', code, { shouldDirty: true })
              }
              ariaLabel="Phone country code"
            />
            <input
              type="tel"
              // The field's visible "Phone" label is inside a <label> that wraps
              // both controls, so it attaches to the first one, the combobox,
              // which then overrides it with its own aria-label. That leaves the
              // number box unnamed unless it names itself.
              aria-label="Phone number"
              autoComplete="tel-national"
              placeholder="5X XXX XXXX"
              className={inputCls}
              {...register('phone')}
            />
          </div>
        </Field>
        <Field label="Country">
          {/* The seven most likely answers first, then every country in
              alphabetical order. The group labels are what stop the pinned
              seven reading as a sorting fault. */}
          <select className={inputCls} defaultValue="" {...register('country')}>
            <option value="">Select a country</option>
            <optgroup label="Frequently selected">
              {PINNED_COUNTRIES.map((c) => (
                <option key={`pin-${c.code}`} value={c.name}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="All countries">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field label="Service of interest">
          <select
            className={inputCls}
            defaultValue={defaultServiceTitle ?? ''}
            {...register('service_interest')}
          >
            <option value="">Select a service</option>
            {services.map((s) => (
              <option key={s.slug} value={s.title}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="How can we help?"
        error={errors.message?.message}
        required
      >
        <textarea
          rows={5}
          className={`${inputCls} resize-y`}
          placeholder="Tell us about the mandate, timing, and any constraints we should know about."
          {...register('message', {
            required: 'A short message helps us route this to the right person',
            minLength: { value: 10, message: 'A bit more context, please' },
          })}
        />
      </Field>

      {hcaptchaSiteKey && (
        <div className="pt-1">
          <HCaptcha
            ref={captchaRef}
            sitekey={hcaptchaSiteKey}
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </div>
      )}

      <div className="flex flex-col-reverse items-start gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-[color:var(--pmbc-muted)]">
          By submitting, you agree to our{' '}
          <a href="/privacy" className="underline hover:text-[color:var(--pmbc-primary)]">
            privacy policy
          </a>
          .
        </p>
        <button
          type="submit"
          disabled={status.kind === 'submitting'}
          className="inline-flex items-center justify-center rounded-md bg-[color:var(--pmbc-primary)] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[color:var(--pmbc-primary-deep)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status.kind === 'submitting' ? 'Sending…' : 'Send message'}
        </button>
      </div>

      {status.kind === 'success' && (
        <div className="rounded-md border border-[color:var(--pmbc-secondary)]/30 bg-[color:var(--pmbc-secondary)]/10 px-4 py-3 text-[13.5px] text-[color:var(--pmbc-text)]">
          Thank you. We&apos;ve received your message and will respond within one
          to two business days.
        </div>
      )}
      {status.kind === 'error' && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
          {status.message}
        </div>
      )}
    </form>
  );
}

const inputCls =
  'block w-full rounded-md border border-[color:var(--pmbc-border)] bg-white px-3.5 py-2.5 text-[14px] text-[color:var(--pmbc-text)] placeholder:text-[color:var(--pmbc-muted)]/70 outline-none transition focus:border-[color:var(--pmbc-primary)] focus:ring-2 focus:ring-[color:var(--pmbc-primary)]/15';

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[color:var(--pmbc-text)]/80">
        {label}
        {required && <span className="ml-1 text-[color:var(--pmbc-accent)]">*</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-[12px] text-red-600">{error}</span>
      )}
    </label>
  );
}
