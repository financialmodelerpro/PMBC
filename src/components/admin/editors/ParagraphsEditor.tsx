'use client';

import { RichTextEditor } from '@/components/admin/RichTextEditor';

import type { SectionEditorProps } from './types';

export function ParagraphsEditor({ content, onChange }: SectionEditorProps) {
  const html = typeof content.html === 'string' ? content.html : '';
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[#0F2540]">Body</p>
      <RichTextEditor
        value={html}
        onChange={(next) => onChange({ ...content, html: next })}
        ariaLabel="Paragraphs body editor"
        minHeight={260}
      />
    </div>
  );
}
