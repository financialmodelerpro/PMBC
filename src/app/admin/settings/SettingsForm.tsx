'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Check, AlertCircle } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  ADMIN_COLORS,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminCard,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
import type { SiteSettings } from '@/lib/cms/settings';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

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
    } catch (e) {
      setState('error');
      setErrMsg((e as Error).message);
    }
  };

  // FMP-style toast: auto-dismiss the success/error toast after a moment.
  useEffect(() => {
    if (state === 'saved' || state === 'error') {
      const t = setTimeout(() => setState('idle'), 2600);
      return () => clearTimeout(t);
    }
  }, [state]);

  const saving = state === 'saving';

  return (
    <form id="site-settings-form" onSubmit={handleSubmit(onSubmit)}>
      {/* Save-All button at the top, mirroring FMP's header-settings pattern. */}
      <AdminPageHeader
        eyebrow="Admin"
        title="Site Settings"
        description="Contact details, social links, default OG image, and analytics. Stored as a single site_settings JSONB blob."
        actions={
          <button
            type="submit"
            disabled={saving}
            style={saving ? adminButtonPrimaryDisabled : adminButtonPrimary}
          >
            {saving ? 'Saving…' : 'Save all settings'}
          </button>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
      </div>

      <Toast state={state} message={errMsg} />
    </form>
  );
}

/** FMP-style floating toast, fixed bottom-right (CMS_REFERENCE.md §7.3). */
function Toast({ state, message }: { state: SaveState; message?: string }) {
  if (state !== 'saved' && state !== 'error') return null;
  const success = state === 'saved';
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        borderRadius: 8,
        background: success ? '#1A7A30' : '#DC2626',
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        zIndex: 9999,
      }}
    >
      {success ? <Check size={15} /> : <AlertCircle size={15} />}
      {success ? 'Settings saved' : message ?? 'Save failed'}
    </div>
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
