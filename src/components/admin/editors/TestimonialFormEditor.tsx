'use client';

import { ADMIN_COLORS, adminInput, adminLabel, adminTextarea } from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Editor for the client testimonial submission form.
 *
 * Everything here is wording. The fields the form collects are fixed, because
 * each one maps to a column the moderation queue and the public block read, and
 * a form whose fields an operator can rearrange would be a form whose output
 * does not fit the table it writes to.
 */
export function TestimonialFormEditor({ content, onChange }: SectionEditorProps) {
  const update = (patch: Record<string, unknown>) => onChange({ ...content, ...patch });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Eyebrow">
        <input
          type="text"
          value={s(content.eyebrow)}
          onChange={(e) => update({ eyebrow: e.target.value })}
          style={adminInput}
        />
      </Field>

      <Field label="Heading">
        <input
          type="text"
          value={s(content.heading)}
          onChange={(e) => update({ heading: e.target.value })}
          style={adminInput}
        />
      </Field>

      <Field label="Intro">
        <textarea
          value={s(content.intro)}
          onChange={(e) => update({ intro: e.target.value })}
          rows={3}
          style={adminTextarea}
        />
      </Field>

      <Field label="Consent wording">
        <textarea
          value={s(content.consent_label)}
          onChange={(e) => update({ consent_label: e.target.value })}
          rows={3}
          style={adminTextarea}
        />
      </Field>
      <p style={{ margin: '-8px 0 0', fontSize: 11, color: ADMIN_COLORS.textMuted }}>
        The box is unticked by default and the form cannot be submitted without it.
        This is the record that a client agreed to be published, which is what the
        confidentiality statement commits the firm to holding, so word it as
        something a person would be content to have quoted back to them.
      </p>

      <Field label="Button label">
        <input
          type="text"
          value={s(content.button_label)}
          onChange={(e) => update({ button_label: e.target.value })}
          style={adminInput}
        />
      </Field>

      <Field label="Message after submitting">
        <textarea
          value={s(content.success_message)}
          onChange={(e) => update({ success_message: e.target.value })}
          rows={3}
          style={adminTextarea}
        />
      </Field>

      <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textBody }}>
        The form collects a name, role, company, the testimonial, an optional
        LinkedIn URL and an optional photo. Everything arrives in the Testimonials
        queue as pending and appears nowhere until approved.
      </p>
      <p style={{ margin: 0, fontSize: 11, color: ADMIN_COLORS.textMuted }}>
        To send one client a private link, create it under Testimonial Links and
        add <code>?t=TOKEN</code> to the address of whichever page carries this
        section. The submission is then stamped with the link it came through.
      </p>
    </div>
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
