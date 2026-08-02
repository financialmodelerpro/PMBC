'use client';

import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { adminFieldHint, adminInput, adminLabel } from '@/lib/admin/styles';
import { PROSE_ALIGN_OPTIONS, readProseAlign } from '@/lib/public/prose';

import type { SectionEditorProps } from './types';

export function ParagraphsEditor({ content, onChange }: SectionEditorProps) {
  const html = typeof content.html === 'string' ? content.html : '';
  const heading = typeof content.heading === 'string' ? content.heading : '';
  const align = readProseAlign(content.align);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <label style={adminLabel}>Heading (optional)</label>
        <input
          type="text"
          value={heading}
          placeholder="Leave empty for body copy with no heading"
          onChange={(e) => onChange({ ...content, heading: e.target.value })}
          style={adminInput}
        />
        <p style={adminFieldHint}>
          Renders above the text with the gold hairline, left aligned.
        </p>
      </div>

      <div>
        <label style={adminLabel}>Text alignment</label>
        <select
          value={align}
          onChange={(e) => onChange({ ...content, align: e.target.value })}
          style={adminInput}
        >
          {PROSE_ALIGN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p style={adminFieldHint}>
          Applies to the whole block. Justified copy is hyphenated automatically so the
          spacing stays even. Aligning a single paragraph from the toolbar overrides this
          for that paragraph.
        </p>
      </div>

      <div>
        <p style={adminLabel}>Body</p>
        <RichTextEditor
          value={html}
          onChange={(next) => onChange({ ...content, html: next })}
          ariaLabel="Paragraphs body editor"
          minHeight={260}
        />
      </div>
    </div>
  );
}
