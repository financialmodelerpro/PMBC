'use client';

import { ADMIN_COLORS, adminInput, adminLabel, adminTextarea } from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Editor for the /contact body: the enquiry form panel and the direct-contact
 * column beside it.
 *
 * Thirteen strings that were rows in `cms_content` under `contact` until
 * migration 066, grouped here the way they are grouped on the page rather than
 * listed alphabetically the way the key-value editor showed them.
 *
 * What is deliberately absent: the addresses, WhatsApp and office line. Those
 * are the firm's, not this page's, and the footer publishes the same values, so
 * they stay in Site Settings. The two calls to action point at /book in the
 * renderer; only their labels are copy.
 */
export function ContactBodyEditor({ content, onChange }: SectionEditorProps) {
  const update = (patch: Record<string, unknown>) => onChange({ ...content, ...patch });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Fieldset legend="Form panel">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Eyebrow">
            <input
              type="text"
              value={s(content.form_eyebrow)}
              onChange={(e) => update({ form_eyebrow: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Heading">
            <input
              type="text"
              value={s(content.form_heading)}
              onChange={(e) => update({ form_heading: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field
            label="Response-time line"
            hint="Leave empty to remove the line. Empty means removed, not reset to the shipped wording."
          >
            <textarea
              value={s(content.form_response_note)}
              onChange={(e) => update({ form_response_note: e.target.value })}
              rows={2}
              style={adminTextarea}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Booking callout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Prompt">
            <input
              type="text"
              value={s(content.booking_prompt)}
              onChange={(e) => update({ booking_prompt: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Body">
            <textarea
              value={s(content.booking_body)}
              onChange={(e) => update({ booking_body: e.target.value })}
              rows={2}
              style={adminTextarea}
            />
          </Field>
          <Field label="Button label" hint="Links to /book.">
            <input
              type="text"
              value={s(content.booking_cta_label)}
              onChange={(e) => update({ booking_cta_label: e.target.value })}
              style={adminInput}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Direct contact column">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Eyebrow">
            <input
              type="text"
              value={s(content.direct_eyebrow)}
              onChange={(e) => update({ direct_eyebrow: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Heading">
            <input
              type="text"
              value={s(content.direct_heading)}
              onChange={(e) => update({ direct_heading: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field
            label="Intro"
            hint="The addresses under this line come from Site Settings, since the footer publishes the same ones."
          >
            <textarea
              value={s(content.direct_intro)}
              onChange={(e) => update({ direct_intro: e.target.value })}
              rows={2}
              style={adminTextarea}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Founder card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            label="Name"
            hint="Used for the portrait alt text and the monogram shown when no portrait is set."
          >
            <input
              type="text"
              value={s(content.founder_name)}
              onChange={(e) => update({ founder_name: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Heading">
            <input
              type="text"
              value={s(content.founder_heading)}
              onChange={(e) => update({ founder_heading: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Body">
            <textarea
              value={s(content.founder_body)}
              onChange={(e) => update({ founder_body: e.target.value })}
              rows={3}
              style={adminTextarea}
            />
          </Field>
          <Field label="Link label" hint="Links to /book.">
            <input
              type="text"
              value={s(content.founder_cta_label)}
              onChange={(e) => update({ founder_cta_label: e.target.value })}
              style={adminInput}
            />
          </Field>
        </div>
      </Fieldset>

      <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textMuted }}>
        The portrait on the founder card is read from the founder profile page, so
        uploading a new one there updates this card too.
      </p>
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
      <span style={adminLabel}>{label}</span>
      {children}
      {hint && (
        <span
          style={{
            display: 'block',
            marginTop: 5,
            fontSize: 11,
            color: ADMIN_COLORS.textMuted,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
