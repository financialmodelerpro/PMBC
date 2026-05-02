'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import {
  ADMIN_COLORS,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminCard,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
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
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <Section title="Contact">
        <Field label="Contact email" hint="Public-facing">
          <input type="email" {...register('contact_email')} style={adminInput} />
        </Field>
        <Field label="Admin email" hint="Where contact-form notifications go">
          <input type="email" {...register('admin_email')} style={adminInput} />
        </Field>
        <Field label="Phone number">
          <input type="tel" {...register('phone_number')} style={adminInput} />
        </Field>
        <Field label="WhatsApp number">
          <input type="tel" {...register('whatsapp_number')} style={adminInput} />
        </Field>
        <Field label="Office location text">
          <input type="text" {...register('office_location_text')} style={adminInput} />
        </Field>
      </Section>

      <Section title="Social">
        <Field label="LinkedIn URL">
          <input type="url" {...register('social_linkedin')} style={adminInput} />
        </Field>
        <Field label="X / Twitter URL">
          <input type="url" {...register('social_twitter')} style={adminInput} />
        </Field>
      </Section>

      <Section title="SEO and analytics">
        <Field label="Default OG image URL" hint="Used when a page has no specific image">
          <input type="text" {...register('default_og_image_url')} style={adminInput} />
        </Field>
        <Field label="Google Analytics ID" hint="e.g. G-XXXXXXXXXX">
          <input type="text" {...register('google_analytics_id')} style={adminInput} />
        </Field>
      </Section>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 18,
          borderTop: `1px solid ${ADMIN_COLORS.border}`,
        }}
      >
        <SaveStatus state={state} message={errMsg} />
        <button
          type="submit"
          disabled={state === 'saving'}
          style={state === 'saving' ? adminButtonPrimaryDisabled : adminButtonPrimary}
        >
          {state === 'saving' ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={adminCard}>
      <h2
        style={{
          margin: '0 0 14px',
          fontSize: 14,
          fontWeight: 700,
          color: ADMIN_COLORS.textHeading,
        }}
      >
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
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
    <label style={{ display: 'block' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <span style={adminLabel}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}
