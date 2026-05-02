'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import type { SiteSettings } from '@/lib/cms/settings';

type FormValues = Required<{
  contact_email: string;
  admin_email: string;
  whatsapp_number: string;
  phone_number: string;
  office_location_text: string;
  social_linkedin: string;
  social_twitter: string;
  default_og_image_url: string;
  google_analytics_id: string;
}>;

const inputCls =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15';

function defaults(initial: SiteSettings): FormValues {
  return {
    contact_email: initial.contact_email ?? '',
    admin_email: initial.admin_email ?? '',
    whatsapp_number: initial.whatsapp_number ?? '',
    phone_number: initial.phone_number ?? '',
    office_location_text: initial.office_location_text ?? '',
    social_linkedin: initial.social_linkedin ?? '',
    social_twitter: initial.social_twitter ?? '',
    default_og_image_url: initial.default_og_image_url ?? '',
    google_analytics_id: initial.google_analytics_id ?? '',
  };
}

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [state, setState] = useState<SaveState>('idle');
  const [errMsg, setErrMsg] = useState<string | undefined>();
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: defaults(initial),
  });

  const onSubmit = async (values: FormValues) => {
    setState('saving');
    setErrMsg(undefined);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }
      setState('saved');
      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      setState('error');
      setErrMsg((e as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section title="Contact">
        <Field label="Contact email" hint="Public-facing">
          <input type="email" {...register('contact_email')} className={inputCls} />
        </Field>
        <Field label="Admin email" hint="Where contact-form notifications go">
          <input type="email" {...register('admin_email')} className={inputCls} />
        </Field>
        <Field label="Phone number">
          <input type="tel" {...register('phone_number')} className={inputCls} />
        </Field>
        <Field label="WhatsApp number">
          <input type="tel" {...register('whatsapp_number')} className={inputCls} />
        </Field>
        <Field label="Office location text">
          <input type="text" {...register('office_location_text')} className={inputCls} />
        </Field>
      </Section>

      <Section title="Social">
        <Field label="LinkedIn URL">
          <input type="url" {...register('social_linkedin')} className={inputCls} />
        </Field>
        <Field label="X / Twitter URL">
          <input type="url" {...register('social_twitter')} className={inputCls} />
        </Field>
      </Section>

      <Section title="SEO and analytics">
        <Field label="Default OG image URL" hint="Used when a page has no specific image">
          <input type="text" {...register('default_og_image_url')} className={inputCls} />
        </Field>
        <Field label="Google Analytics ID" hint="e.g. G-XXXXXXXXXX">
          <input type="text" {...register('google_analytics_id')} className={inputCls} />
        </Field>
      </Section>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
        <SaveStatus state={state} message={errMsg} />
        <button
          type="submit"
          disabled={state === 'saving'}
          className="rounded-md bg-[#1B3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F2540] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
      <h2 className="mb-4 text-sm font-semibold text-[#0F1B2D]">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-[#0F2540]">{label}</span>
        {hint && <span className="text-[11px] text-neutral-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
