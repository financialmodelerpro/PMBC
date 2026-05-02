'use client';

import { HeroEditor } from '@/components/admin/editors/HeroEditor';
import { ParagraphsEditor } from '@/components/admin/editors/ParagraphsEditor';
import { StatsBlockEditor } from '@/components/admin/editors/StatsBlockEditor';
import { ServiceCardsEditor } from '@/components/admin/editors/ServiceCardsEditor';
import type { SectionEditorProps } from '@/components/admin/editors/types';
import { getSectionMeta } from '@/lib/cms/sectionTypes';

const EDITORS: Record<string, (props: SectionEditorProps) => React.ReactElement> = {
  hero: HeroEditor,
  paragraphs: ParagraphsEditor,
  stats_block: StatsBlockEditor,
  service_cards: ServiceCardsEditor,
};

export function SectionEditorPanel({
  sectionType,
  content,
  onChange,
}: {
  sectionType: string;
  content: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const meta = getSectionMeta(sectionType);
  const Editor = EDITORS[sectionType];

  if (!Editor) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6">
        <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-neutral-500">
          {meta?.label ?? sectionType}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Editor for <code className="font-mono">{sectionType}</code> ships in Phase 6. The
          section row exists in the database; reorder, visibility, and delete still work for
          it.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-neutral-500">
            Inspect raw JSON
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-neutral-900 p-3 text-[11px] text-neutral-100">
            {JSON.stringify(content, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return <Editor content={content} onChange={onChange} />;
}
