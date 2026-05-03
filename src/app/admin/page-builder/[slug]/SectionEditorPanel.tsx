'use client';

import { HeroEditor } from '@/components/admin/editors/HeroEditor';
import { ParagraphsEditor } from '@/components/admin/editors/ParagraphsEditor';
import { StatsBlockEditor } from '@/components/admin/editors/StatsBlockEditor';
import { ServiceCardsEditor } from '@/components/admin/editors/ServiceCardsEditor';
import { SectorGridEditor } from '@/components/admin/editors/SectorGridEditor';
import { ProcessStepsEditor } from '@/components/admin/editors/ProcessStepsEditor';
import { NetworkPartnersEditor } from '@/components/admin/editors/NetworkPartnersEditor';
import { FounderEditor } from '@/components/admin/editors/FounderEditor';
import { TextImageEditor } from '@/components/admin/editors/TextImageEditor';
import { CtaBlockEditor } from '@/components/admin/editors/CtaBlockEditor';
import { QuoteEditor } from '@/components/admin/editors/QuoteEditor';
import { FmpIntroEditor } from '@/components/admin/editors/FmpIntroEditor';
import { ServiceDetailEditor } from '@/components/admin/editors/ServiceDetailEditor';
import type { SectionEditorProps } from '@/components/admin/editors/types';
import { ADMIN_COLORS } from '@/lib/admin/styles';
import { getSectionMeta } from '@/lib/cms/sectionTypes';

const EDITORS: Record<string, (props: SectionEditorProps) => React.ReactElement> = {
  hero: HeroEditor,
  paragraphs: ParagraphsEditor,
  stats_block: StatsBlockEditor,
  service_cards: ServiceCardsEditor,
  sector_grid: SectorGridEditor,
  process_steps: ProcessStepsEditor,
  network_partners: NetworkPartnersEditor,
  founder_block: FounderEditor,
  text_image: TextImageEditor,
  cta_block: CtaBlockEditor,
  quote: QuoteEditor,
  fmp_intro: FmpIntroEditor,
  service_detail: ServiceDetailEditor,
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
      <div
        style={{
          background: '#F9FAFB',
          border: `1px dashed ${ADMIN_COLORS.borderInput}`,
          borderRadius: 10,
          padding: 22,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMuted,
          }}
        >
          {meta?.label ?? sectionType}
        </p>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 13,
            color: ADMIN_COLORS.textBody,
          }}
        >
          Editor for{' '}
          <code
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {sectionType}
          </code>{' '}
          ships in Phase 6. The section row exists in the database; reorder, visibility, and
          delete still work for it.
        </p>
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
            Inspect raw JSON
          </summary>
          <pre
            style={{
              marginTop: 8,
              maxHeight: 256,
              overflow: 'auto',
              background: '#0F172A',
              color: '#F1F5F9',
              padding: 12,
              borderRadius: 6,
              fontSize: 11,
            }}
          >
            {JSON.stringify(content, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return <Editor content={content} onChange={onChange} />;
}
