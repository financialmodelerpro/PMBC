'use client';

import { useState, type CSSProperties } from 'react';
import { useForm, type UseFormRegister } from 'react-hook-form';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import {
  ADMIN_COLORS,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminCard,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
import type { BrandingConfig } from '@/lib/cms/branding';

type FormValues = {
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  brand_name: string;
  short_name: string;
  tagline: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function toForm(b: BrandingConfig): FormValues {
  return {
    logo_url: b.logo_url ?? '',
    logo_dark_url: b.logo_dark_url ?? '',
    favicon_url: b.favicon_url ?? '',
    brand_name: b.brand_name,
    short_name: b.short_name,
    tagline: b.tagline,
    primary_color: b.primary_color,
    secondary_color: b.secondary_color,
    accent_color: b.accent_color,
  };
}

export function BrandingForm({ initial }: { initial: BrandingConfig }) {
  const [state, setState] = useState<SaveState>('idle');
  const [errMsg, setErrMsg] = useState<string | undefined>();

  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: toForm(initial),
  });

  const v = watch();

  const onSubmit = async (values: FormValues) => {
    setState('saving');
    setErrMsg(undefined);
    try {
      const payload = {
        ...values,
        logo_url: values.logo_url.trim() || null,
        logo_dark_url: values.logo_dark_url.trim() || null,
        favicon_url: values.favicon_url.trim() || null,
      };
      const res = await fetch('/api/admin/branding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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
      style={{
        display: 'grid',
        gap: 24,
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Section title="Identity">
          <Field label="Brand name" hint="Full legal display name">
            <input {...register('brand_name', { required: true })} style={adminInput} type="text" />
          </Field>
          <Field label="Short name" hint="Used in nav and compact contexts">
            <input {...register('short_name', { required: true })} style={adminInput} type="text" />
          </Field>
          <Field label="Tagline">
            <input {...register('tagline', { required: true })} style={adminInput} type="text" />
          </Field>
        </Section>

        <Section title="Logos">
          <Field label="Logo URL" hint="External URL or /path under public/">
            <input
              {...register('logo_url')}
              style={adminInput}
              type="text"
              placeholder="/logo.svg or https://…"
            />
          </Field>
          <Field label="Dark logo URL" hint="Used on dark backgrounds (optional)">
            <input
              {...register('logo_dark_url')}
              style={adminInput}
              type="text"
              placeholder="/logo-dark.svg or https://…"
            />
          </Field>
          <Field label="Favicon URL">
            <input
              {...register('favicon_url')}
              style={adminInput}
              type="text"
              placeholder="/favicon.ico"
            />
          </Field>
        </Section>

        <Section title="Color tokens">
          <ColorField
            label="Primary"
            name="primary_color"
            register={register}
            value={v.primary_color}
          />
          <ColorField
            label="Secondary"
            name="secondary_color"
            register={register}
            value={v.secondary_color}
          />
          <ColorField
            label="Accent"
            name="accent_color"
            register={register}
            value={v.accent_color}
          />
        </Section>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 20,
            borderTop: `1px solid ${ADMIN_COLORS.border}`,
          }}
        >
          <SaveStatus state={state} message={errMsg} />
          <button
            type="submit"
            disabled={state === 'saving'}
            style={state === 'saving' ? adminButtonPrimaryDisabled : adminButtonPrimary}
          >
            {state === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <aside style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMuted,
          }}
        >
          Preview
        </p>
        <BrandPreview values={v} />
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={adminCard}>
      <h2
        style={{
          margin: '0 0 16px',
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

function ColorField({
  label,
  name,
  register,
  value,
}: {
  label: string;
  name: 'primary_color' | 'secondary_color' | 'accent_color';
  register: UseFormRegister<FormValues>;
  value: string;
}) {
  const valid = HEX.test(value);
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          {...register(name)}
          style={{
            width: 44,
            height: 36,
            padding: 2,
            border: `1px solid ${ADMIN_COLORS.borderInput}`,
            borderRadius: 7,
            background: '#FFFFFF',
            cursor: 'pointer',
          }}
        />
        <input
          type="text"
          {...register(name, { pattern: HEX })}
          style={adminInput}
          placeholder="#1B3A5F"
        />
        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 6,
            border: `1px solid ${ADMIN_COLORS.border}`,
            background: valid ? value : 'transparent',
          }}
        />
      </div>
      {!valid && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: ADMIN_COLORS.danger }}>
          Use a hex value like #1B3A5F
        </p>
      )}
    </Field>
  );
}

function BrandPreview({ values }: { values: FormValues }) {
  const primary = HEX.test(values.primary_color) ? values.primary_color : '#1B3A5F';
  const accent = HEX.test(values.accent_color) ? values.accent_color : '#D4A93A';
  const secondary = HEX.test(values.secondary_color) ? values.secondary_color : '#3FA663';

  const chip: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    color: '#FFFFFF',
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${ADMIN_COLORS.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: primary,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {values.logo_url ? (
          <img
            src={values.logo_url}
            alt=""
            style={{ height: 28, width: 'auto' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#E8EEF5',
            }}
          >
            {values.short_name || 'Logo'}
          </span>
        )}
        <div style={{ marginLeft: 'auto', height: 1, width: 40, background: accent }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Sample header</span>
      </div>
      <div style={{ padding: 18 }}>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMuted,
          }}
        >
          {values.short_name || 'Short name'}
        </p>
        <h3
          style={{
            margin: '6px 0 0',
            fontSize: 18,
            fontWeight: 700,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          {values.brand_name || 'Brand name'}
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>
          {values.tagline || 'Tagline appears here'}
        </p>
        <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ ...chip, background: primary }}>Primary</span>
          <span style={{ ...chip, background: secondary }}>Secondary</span>
          <span style={{ ...chip, background: accent, color: ADMIN_COLORS.primaryDeep }}>
            Accent
          </span>
        </div>
      </div>
    </div>
  );
}
