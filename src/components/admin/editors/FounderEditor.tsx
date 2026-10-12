'use client';

import Link from 'next/link';

import {
  ADMIN_COLORS,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';
import { BodyAlignField } from './BodyAlignField';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function FounderEditor({ content, onChange }: SectionEditorProps) {
  const photo_url = s(content.photo_url);
  const photo_alt = s(content.photo_alt);
  const name = s(content.name);
  const credentials_line = s(content.credentials_line) || s(content.title);
  const bio_html = s(content.bio_html) || s(content.bio);
  const cta_primary_label = s(content.cta_primary_label);
  const cta_primary_href = s(content.cta_primary_href);
  const cta_secondary_label = s(content.cta_secondary_label);
  const cta_secondary_href = s(content.cta_secondary_href);
  const layout = content.layout === 'image_right' ? 'image_right' : 'image_left';
  const credentials = Array.isArray(content.credentials)
    ? content.credentials.map((i) => (typeof i === 'string' ? i : ''))
    : [];
  const credentials_label = s(content.credentials_label);

  const update = (patch: Record<string, unknown>) => {
    const { bio: _legacy, title: _legacyTitle, ...rest } = content;
    void _legacy;
    void _legacyTitle;
    onChange({
      ...rest,
      photo_url,
      photo_alt,
      name,
      credentials_line,
      bio_html,
      cta_primary_label,
      cta_primary_href,
      cta_secondary_label,
      cta_secondary_href,
      credentials,
      credentials_label,
      layout,
      ...patch,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Empty is the right default, not an oversight. The name is printed
          beside the portrait, so alt text that repeats it makes a screen reader
          announce the person twice. Fill this in only if the picture carries
          something the surrounding text does not. */}
      <Field label="Photo alt text">
        <input
          type="text"
          value={photo_alt}
          onChange={(e) => update({ photo_alt: e.target.value })}
          placeholder="Leave empty: the name beside the photo already names the person"
          style={adminInput}
        />
      </Field>


      <BodyAlignField
        value={content.body_align}
        onChange={(next) => update({ body_align: next })}
      />


      {/* Says whose record the proof points are. They are career figures rather
          than firm figures, and the home page carries both, so the counterpart
          of the stats block's own note belongs here. Renders only when there is
          at least one proof point. */}
      <Field label="Proof points label">
        <input
          style={adminInput}
          value={credentials_label}
          onChange={(e) => update({ credentials_label: e.target.value })}
          placeholder="The partner's career record, distinct from the firm's."
        />
      </Field>


      <Fieldset legend="Primary CTA (optional, links to his profile)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <Field label="Label">
            <input
              type="text"
              value={cta_primary_label}
              onChange={(e) => update({ cta_primary_label: e.target.value })}
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

      <Field label="Layout">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['image_left', 'image_right'] as const).map((option) => {
            const active = layout === option;
            const label = option === 'image_left' ? 'Image left' : 'Image right';
            return (
              <button
                key={option}
                type="button"
                onClick={() => update({ layout: option })}
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
