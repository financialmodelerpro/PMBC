'use client';

import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { adminLabel } from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

export function ParagraphsEditor({ content, onChange }: SectionEditorProps) {
  const html = typeof content.html === 'string' ? content.html : '';
  return (
    <div>
      <p style={adminLabel}>Body</p>
      <RichTextEditor
        value={html}
        onChange={(next) => onChange({ ...content, html: next })}
        ariaLabel="Paragraphs body editor"
        minHeight={260}
      />
    </div>
  );
}
