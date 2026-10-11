'use client';

import { ADMIN_COLORS, adminInput, adminLabel, adminTextarea } from '@/lib/admin/styles';
import { SERVICES, SERVICE_GROUPS } from '@/config/services';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Editor for the /services card grid.
 *
 * Only the copy above the cards is editable here. The nine cards come from the
 * Services collection, with `src/config/services.ts` as the fallback, because
 * the same nine feed the related-services cards on each detail page, the
 * contact form's dropdown, the sitemap and the JSON-LD. Editing them in one
 * section would leave the other four reading the old values.
 */
export function ServiceGridEditor({ content, onChange }: SectionEditorProps) {
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

      <Field label="Standfirst">
        <textarea
          value={s(content.intro)}
          onChange={(e) => update({ intro: e.target.value })}
          rows={3}
          style={adminTextarea}
        />
      </Field>

      {SERVICE_GROUPS.map((g) => {
        const key = `group_${g.index}_name`;
        return (
          <Field key={key} label={`Group ${g.index} name`}>
            <input
              type="text"
              value={typeof content[key] === 'string' ? s(content[key]) : g.name}
              onChange={(e) => update({ [key]: e.target.value })}
              style={adminInput}
            />
          </Field>
        );
      })}

      <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.textBody }}>
        The {SERVICES.length} cards below this copy come from the Services collection,
        not from this section, in three practice groups. Which group a service
        sits in is set in code; its order within the group is its display order
        in the collection. Clearing the eyebrow, heading and standfirst removes
        the heading block and leaves the cards on their own.
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
