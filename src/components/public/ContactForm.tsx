'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type Service = { slug: string; title: string };

const COUNTRIES = [
  'Saudi Arabia',
  'United Arab Emirates',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
  'Other',
] as const;

type FormValues = {
  name: string;
  email: string;
  company?: string;
  phone?: string;
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
}: {
  services: Service[];
  hcaptchaSiteKey: string | null;
}) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

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

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
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
          <input
            type="tel"
            autoComplete="tel"
            className={inputCls}
            {...register('phone')}
          />
        </Field>
        <Field label="Country">
          <select className={inputCls} defaultValue="" {...register('country')}>
            <option value="">Select a country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service of interest">
          <select className={inputCls} defaultValue="" {...register('service_interest')}>
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
          Thank you. We&apos;ve received your message and will respond within 1–2
          business days.
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
