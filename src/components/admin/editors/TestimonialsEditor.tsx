'use client';

import { ADMIN_COLORS, adminInput, adminLabel } from '@/lib/admin/styles';
import { ToggleSwitch } from '@/components/admin/ToggleSwitch';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Editor for the testimonials section.
 *
 * Only the heading block is editable here. The quotes themselves live in the
 * Testimonials queue, where they are approved, ordered and withdrawn, so a
 * second place to edit their wording would be a second place for them to drift
 * from what the client actually agreed to.
 */
export function TestimonialsEditor({ content, onChange }: SectionEditorProps) {
  const update = (patch: Record<string, unknown>) => onChange({ ...content, ...patch });
  const onlyLanding = content.only_landing === true;

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

      <Field label="Maximum number to show">
        <input
          type="number"
          min={1}
          value={s(content.max_items)}
          onChange={(e) => update({ max_items: e.target.value })}
          style={adminInput}
          placeholder="Leave empty for all of them"
        />
      </Field>
      <p style={{ margin: '-8px 0 0', fontSize: 11, color: ADMIN_COLORS.textMuted }}>
        One or two where this is a proof point inside a longer page. Empty shows
        every approved quote. The ones shown are the first by display order, so
        the queue decides which two rather than chance.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ToggleSwitch
          checked={onlyLanding}
          onChange={(next) => update({ only_landing: next })}
          label="Show only testimonials flagged for the homepage"
        />
        <span style={{ fontSize: 12, color: ADMIN_COLORS.textBody }}>
          Only those flagged for the homepage
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textBody }}>
        The quotes come from the Testimonials queue, where they are approved and
        ordered. Off, this section shows every approved quote. On, it shows only
        those with the homepage switch set, which is how you put a short selection
        on one page and the full set on another.
      </p>
      <p style={{ margin: 0, fontSize: 11, color: ADMIN_COLORS.textMuted }}>
        With no approved quote to show, the section renders nothing at all rather
        than an empty band under a heading.
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
