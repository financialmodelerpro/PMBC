'use client';

import { ADMIN_COLORS, adminInput, adminLabel, adminTextarea } from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Editor for the /book body: the calendar band and the direct routes under it.
 *
 * Eight strings that were rows in `cms_content` under `booking` until migration
 * 066.
 *
 * The calendar URL is not here. It is a site-wide setting rather than page
 * copy, it lives in Site Settings, and every booking surface reads the same
 * one. That is also what decides which of the two states below renders.
 */
export function BookingBodyEditor({ content, onChange }: SectionEditorProps) {
  const update = (patch: Record<string, unknown>) => onChange({ ...content, ...patch });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Fieldset legend="Calendar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Eyebrow">
            <input
              type="text"
              value={s(content.calendar_eyebrow)}
              onChange={(e) => update({ calendar_eyebrow: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Prompt under the calendar">
            <input
              type="text"
              value={s(content.fallback_prompt)}
              onChange={(e) => update({ fallback_prompt: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Link label" hint="Opens the same calendar in a new tab.">
            <input
              type="text"
              value={s(content.fallback_link_label)}
              onChange={(e) => update({ fallback_link_label: e.target.value })}
              style={adminInput}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="When no calendar URL is set">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Heading">
            <input
              type="text"
              value={s(content.empty_heading)}
              onChange={(e) => update({ empty_heading: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Body">
            <textarea
              value={s(content.empty_body)}
              onChange={(e) => update({ empty_body: e.target.value })}
              rows={2}
              style={adminTextarea}
            />
          </Field>
          <p style={{ margin: 0, fontSize: 11, color: ADMIN_COLORS.textMuted }}>
            Shown in place of the calendar while the Booking URL in Site Settings is
            empty. It is not what a visitor sees if the calendar fails to load in
            their browser, so word it for a calendar that is switched off rather
            than one that is broken.
          </p>
        </div>
      </Fieldset>

      <Fieldset legend="Other ways to reach us">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Label">
            <input
              type="text"
              value={s(content.alternatives_label)}
              onChange={(e) => update({ alternatives_label: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field
            label="Text"
            hint="The buttons under this line come from Site Settings: the general address and the WhatsApp number."
          >
            <textarea
              value={s(content.alternatives_text)}
              onChange={(e) => update({ alternatives_text: e.target.value })}
              rows={2}
              style={adminTextarea}
            />
          </Field>
          <Field label="Contact-page button label" hint="Links to /contact.">
            <input
              type="text"
              value={s(content.contact_form_label)}
              onChange={(e) => update({ contact_form_label: e.target.value })}
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
