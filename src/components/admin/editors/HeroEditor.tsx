'use client';

import {
  ADMIN_COLORS,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';
import { RichTextarea } from '@/components/admin/RichTextarea';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function HeroEditor({ content, onChange }: SectionEditorProps) {
  const badge_text = s(content.badge_text) || s(content.badge);
  const headline = s(content.headline);
  const subtitle = s(content.subtitle);
  const cta_label = s(content.cta_label);
  const cta_href = s(content.cta_href);
  const cta_secondary_label = s(content.cta_secondary_label);
  const cta_secondary_href = s(content.cta_secondary_href);
  const background_style = content.background_style === 'dark' ? 'dark' : 'light';
  const tags = Array.isArray(content.tags)
    ? (content.tags as unknown[]).filter((t): t is string => typeof t === 'string')
    : [];

  const update = (patch: Record<string, unknown>) => {
    const { badge: _legacy, ...rest } = content;
    void _legacy;
    onChange({
      ...rest,
      badge_text,
      headline,
      subtitle,
      cta_label,
      cta_href,
      cta_secondary_label,
      cta_secondary_href,
      background_style,
      tags,
      ...patch,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Badge text" hint="Small uppercase eyebrow above the headline">
        <input
          type="text"
          value={badge_text}
          onChange={(e) => update({ badge_text: e.target.value })}
          style={adminInput}
        />
      </Field>

      <Field label="Headline">
        <input
          type="text"
          value={headline}
          onChange={(e) => update({ headline: e.target.value })}
          style={adminInput}
        />
      </Field>

      <Field label="Subtitle">
        <RichTextarea
          value={subtitle}
          onChange={(html) => update({ subtitle: html })}
          minHeight={56}
        />
      </Field>

      <Field
        label="Capability tags"
        hint="One per line. They sit directly under the subtitle and wrap into even rows, so a multiple of four reads best on desktop."
      >
        <textarea
          value={tags.join('\n')}
          rows={5}
          placeholder={'Real Estate Models\nBusiness Valuation\nProject Finance\nRenewable Energy'}
          onChange={(e) =>
            update({
              tags: e.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
          style={{ ...adminInput, resize: 'vertical' }}
        />
      </Field>

      <Fieldset legend="Primary CTA">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Label">
            <input
              type="text"
              value={cta_label}
              onChange={(e) => update({ cta_label: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Link">
            <input
              type="text"
              value={cta_href}
              onChange={(e) => update({ cta_href: e.target.value })}
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
          {(['light', 'dark'] as const).map((option) => {
            const active = background_style === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => update({ background_style: option })}
                style={{
                  padding: '6px 14px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'capitalize',
                  border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.borderInput}`,
                  background: active ? ADMIN_COLORS.primary : '#FFFFFF',
                  color: active ? '#FFFFFF' : ADMIN_COLORS.primaryDeep,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {option}
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
        {hint && (
          <span style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}>{hint}</span>
        )}
      </div>
      {children}
    </label>
  );
}
