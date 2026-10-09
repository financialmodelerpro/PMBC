'use client';

import { adminFieldHint, adminInput, adminLabel } from '@/lib/admin/styles';
import { BODY_ALIGN_OPTIONS, readBodyAlign, type BodyAlign } from '@/lib/public/prose';

/**
 * "Text alignment" for a rich text body other than Paragraphs, which keeps its
 * own four-way control. Left or Justified only; a section that has never set it
 * shows Left, which is how it already renders.
 */
export function BodyAlignField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: BodyAlign) => void;
}) {
  return (
    <div>
      <label style={adminLabel}>Text alignment</label>
      <select
        value={readBodyAlign(value)}
        onChange={(e) => onChange(readBodyAlign(e.target.value))}
        style={adminInput}
      >
        {BODY_ALIGN_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p style={adminFieldHint}>
        Applies to the whole body. Justified copy is hyphenated automatically so the
        spacing stays even. Aligning a single paragraph from the toolbar overrides this
        for that paragraph.
      </p>
    </div>
  );
}
