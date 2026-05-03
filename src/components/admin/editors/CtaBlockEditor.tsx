'use client';

import {
  ADMIN_COLORS,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const BG_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'accent', label: 'Accent' },
] as const;

export function CtaBlockEditor({ content, onChange }: SectionEditorProps) {
  const headline = s(content.headline);
  const subhead = s(content.subhead);
  const cta_primary_label = s(content.cta_primary_label) || s(content.cta_label);
  const cta_primary_href = s(content.cta_primary_href) || s(content.cta_href);
  const cta_secondary_label = s(content.cta_secondary_label);
  const cta_secondary_href = s(content.cta_secondary_href);
  const bg = content.background_style;
  const background_style: 'light' | 'dark' | 'accent' =
    bg === 'dark' || bg === 'accent' ? bg : 'light';

  const update = (patch: Record<string, unknown>) => {
    const { cta_label: _l, cta_href: _h, ...rest } = content;
    void _l;
    void _h;
    onChange({
      ...rest,
      headline,
      subhead,
      cta_primary_label,
      cta_primary_href,
      cta_secondary_label,
      cta_secondary_href,
      background_style,
      ...patch,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Headline">
        <input
          type="text"
          value={headline}
          onChange={(e) => update({ headline: e.target.value })}
          style={adminInput}
        />
      </Field>

      <Field label="Subhead">
        <textarea
          value={subhead}
          onChange={(e) => update({ subhead: e.target.value })}
          rows={2}
          style={adminTextarea}
        />
      </Field>

      <Fieldset legend="Primary CTA">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Label">
            <input
              type="text"
              value={cta_primary_label}
              onChange={(e) => update({ cta_primary_label: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Link">
            <input
              type="text"
              value={cta_primary_href}
              onChange={(e) => update({ cta_primary_href: e.target.value })}
              style={adminInput}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Secondary CTA (optional)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Label">
            <input
              type="text"
              value={cta_secondary_label}
              onChange={(e) => update({ cta_secondary_label: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Link">
            <input
              type="text"
              value={cta_secondary_href}
              onChange={(e) => update({ cta_secondary_href: e.target.value })}
              style={adminInput}
            />
          </Field>
        </div>
      </Fieldset>

      <Field label="Background style">
        <div style={{ display: 'flex', gap: 8 }}>
          {BG_OPTIONS.map(({ value, label }) => {
            const active = background_style === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => update({ background_style: value })}
                style={{
                  padding: '6px 14px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.borderInput}`,
                  background: active ? ADMIN_COLORS.primary : '#FFFFFF',
                  color: active ? '#FFFFFF' : ADMIN_COLORS.primaryDeep,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset
      style={{
        border: `1px solid ${ADMIN_COLORS.border}`,
        borderRadius: 10,
        padding: 14,
        margin: 0,
      }}
    >
      <legend
        style={{
          padding: '0 6px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: ADMIN_COLORS.textBody,
        }}
      >
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={adminLabel}>{label}</span>
      {children}
    </label>
  );
}
