'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
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
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-7">
        <Section title="Identity">
          <Field label="Brand name" hint="Full legal display name">
            <input
              {...register('brand_name', { required: true })}
              className={inputCls}
              type="text"
            />
          </Field>
          <Field label="Short name" hint="Used in nav and compact contexts">
            <input
              {...register('short_name', { required: true })}
              className={inputCls}
              type="text"
            />
          </Field>
          <Field label="Tagline">
            <input
              {...register('tagline', { required: true })}
              className={inputCls}
              type="text"
            />
          </Field>
        </Section>

        <Section title="Logos">
          <Field label="Logo URL" hint="External URL or /path under public/">
            <input
              {...register('logo_url')}
              className={inputCls}
              type="text"
              placeholder="/logo.svg or https://…"
            />
          </Field>
          <Field label="Dark logo URL" hint="Used on dark backgrounds (optional)">
            <input
              {...register('logo_dark_url')}
              className={inputCls}
              type="text"
              placeholder="/logo-dark.svg or https://…"
            />
          </Field>
          <Field label="Favicon URL">
            <input
              {...register('favicon_url')}
              className={inputCls}
              type="text"
              placeholder="/favicon.ico"
            />
          </Field>
        </Section>

        <Section title="Color tokens">
          <ColorField label="Primary" name="primary_color" register={register} value={v.primary_color} />
          <ColorField
            label="Secondary"
            name="secondary_color"
            register={register}
            value={v.secondary_color}
          />
          <ColorField label="Accent" name="accent_color" register={register} value={v.accent_color} />
        </Section>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
          <SaveStatus state={state} message={errMsg} />
          <button type="submit" disabled={state === 'saving'} className={primaryBtnCls}>
            {state === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-[11px] font-medium tracking-[0.16em] uppercase text-neutral-500">
          Preview
        </p>
        <BrandPreview values={v} />
      </aside>
    </form>
  );
}

const inputCls =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none transition focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15';

const primaryBtnCls =
  'rounded-md bg-[#1B3A5F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0F2540] disabled:cursor-not-allowed disabled:opacity-60';

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

function ColorField({
  label,
  name,
  register,
  value,
}: {
  label: string;
  name: 'primary_color' | 'secondary_color' | 'accent_color';
  register: ReturnType<typeof useForm<FormValues>>['register'];
  value: string;
}) {
  const valid = HEX.test(value);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          {...register(name)}
          className="h-10 w-12 cursor-pointer rounded border border-neutral-300 bg-white p-1"
        />
        <input
          type="text"
          {...register(name, { pattern: HEX })}
          className={inputCls}
          placeholder="#1B3A5F"
        />
        <span
          className="h-8 w-8 shrink-0 rounded border border-neutral-200"
          style={{ background: valid ? value : 'transparent' }}
          aria-hidden
        />
      </div>
      {!valid && (
        <p className="mt-1 text-[11px] text-red-600">Use a hex value like #1B3A5F</p>
      )}
    </Field>
  );
}

function BrandPreview({ values }: { values: FormValues }) {
  const primary = HEX.test(values.primary_color) ? values.primary_color : '#1B3A5F';
  const accent = HEX.test(values.accent_color) ? values.accent_color : '#D4A93A';

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: primary }}>
        {values.logo_url ? (
          <img
            src={values.logo_url}
            alt=""
            className="h-7 w-auto"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span
            className="text-[10px] tracking-[0.18em] uppercase"
            style={{ color: '#E8EEF5' }}
          >
            {values.short_name || 'Logo'}
          </span>
        )}
        <div className="ml-auto h-px w-10" style={{ background: accent }} />
        <span className="text-xs text-white/80">Sample header</span>
      </div>
      <div className="px-5 py-5">
        <p className="text-[10px] tracking-[0.18em] uppercase text-neutral-500">
          {values.short_name || 'Short name'}
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#0F1B2D]">
          {values.brand_name || 'Brand name'}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          {values.tagline || 'Tagline appears here'}
        </p>
        <div className="mt-4 flex gap-2">
          <span
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: primary }}
          >
            Primary
          </span>
          <span
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white"
            style={{
              background: HEX.test(values.secondary_color)
                ? values.secondary_color
                : '#3FA663',
            }}
          >
            Secondary
          </span>
          <span
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-[#0F1B2D]"
            style={{ background: accent }}
          >
            Accent
          </span>
        </div>
      </div>
    </div>
  );
}
