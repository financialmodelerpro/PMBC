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

export function TextImageEditor({ content, onChange }: SectionEditorProps) {
  const heading = s(content.heading);
  const body_html = s(content.body_html) || s(content.body);
  const image_url = s(content.image_url);
  const image_alt = s(content.image_alt);
  const image_caption = s(content.image_caption);
  const image_position = content.image_position === 'left' ? 'left' : 'right';
  const cta_label = s(content.cta_label);
  const cta_href = s(content.cta_href);

  const update = (patch: Record<string, unknown>) => {
    const { body: _legacy, ...rest } = content;
    void _legacy;
    onChange({
      ...rest,
      heading,
      body_html,
      image_url,
      image_alt,
      image_caption,
      image_position,
      cta_label,
      cta_href,
      ...patch,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Heading">
        <input
          type="text"
          value={heading}
          onChange={(e) => update({ heading: e.target.value })}
          style={adminInput}
        />
      </Field>

      <div>
        <p style={adminLabel}>Body</p>
        <RichTextEditor
          value={body_html}
          onChange={(html) => update({ body_html: html })}
          ariaLabel="Text-image body editor"
          minHeight={180}
        />
      </div>

      <Fieldset legend="Image">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Image URL">
            <input
              type="text"
              value={image_url}
              onChange={(e) => update({ image_url: e.target.value })}
              placeholder="https://…/image.jpg"
              style={adminInput}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Alt text">
              <input
                type="text"
                value={image_alt}
                onChange={(e) => update({ image_alt: e.target.value })}
                style={adminInput}
              />
            </Field>
            <Field label="Caption (optional)">
              <input
                type="text"
                value={image_caption}
                onChange={(e) => update({ image_caption: e.target.value })}
                style={adminInput}
              />
            </Field>
          </div>
          <Field label="Image position">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['left', 'right'] as const).map((option) => {
                const active = image_position === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => update({ image_position: option })}
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
      </Fieldset>

      <Fieldset legend="CTA (optional)">
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
