'use client';

import { RichTextEditor } from '@/components/admin/RichTextEditor';
import {
  ADMIN_COLORS,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function FounderEditor({ content, onChange }: SectionEditorProps) {
  const photo_url = s(content.photo_url);
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

  const update = (patch: Record<string, unknown>) => {
    const { bio: _legacy, title: _legacyTitle, ...rest } = content;
    void _legacy;
    void _legacyTitle;
    onChange({
      ...rest,
      photo_url,
      name,
      credentials_line,
      bio_html,
      cta_primary_label,
      cta_primary_href,
      cta_secondary_label,
      cta_secondary_href,
      credentials,
      layout,
      ...patch,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Photo URL">
        <input
          type="text"
          value={photo_url}
          onChange={(e) => update({ photo_url: e.target.value })}
          placeholder="https://…/founder.jpg"
          style={adminInput}
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Ahmad Din"
            style={adminInput}
          />
        </Field>
        <Field label="Credentials line">
          <input
            type="text"
            value={credentials_line}
            onChange={(e) => update({ credentials_line: e.target.value })}
            placeholder="Founder · CFA · MBA"
            style={adminInput}
          />
        </Field>
      </div>

      <div>
        <p style={adminLabel}>Bio</p>
        <RichTextEditor
          value={bio_html}
          onChange={(html) => update({ bio_html: html })}
          ariaLabel="Founder bio editor"
          minHeight={200}
        />
      </div>

      {/* Proof points under the bio, mirroring FMP's home founder card. The
          renderer shows at most five; this is a summary, and the full list
          lives on the founder profile page. */}
      <Field label={`Proof points (${credentials.length}, first 5 shown)`}>
        <div style={{ display: 'grid', gap: 6 }}>
          {credentials.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...credentials];
                  next[i] = e.target.value;
                  update({ credentials: next });
                }}
                placeholder="12+ years in corporate finance and advisory"
                style={adminInput}
              />
              <button
                type="button"
                aria-label={`Remove proof point ${i + 1}`}
                onClick={() =>
                  update({ credentials: credentials.filter((_, j) => j !== i) })
                }
                style={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: 6,
                  border: `1px solid ${ADMIN_COLORS.border}`,
                  background: '#fff',
                  color: ADMIN_COLORS.textMuted,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update({ credentials: [...credentials, ''] })}
            style={{
              justifySelf: 'start',
              padding: '6px 14px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${ADMIN_COLORS.borderInput}`,
              background: '#FFFFFF',
              color: ADMIN_COLORS.primaryDeep,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Add proof point
          </button>
        </div>
      </Field>

      <Fieldset legend="Primary CTA (optional)">
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
