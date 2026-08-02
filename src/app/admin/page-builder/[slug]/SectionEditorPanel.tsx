'use client';

import { HeroEditor } from '@/components/admin/editors/HeroEditor';
import { ParagraphsEditor } from '@/components/admin/editors/ParagraphsEditor';
import { StatsBlockEditor } from '@/components/admin/editors/StatsBlockEditor';
import { ServiceCardsEditor } from '@/components/admin/editors/ServiceCardsEditor';
import { SectorGridEditor } from '@/components/admin/editors/SectorGridEditor';
import { ProcessStepsEditor } from '@/components/admin/editors/ProcessStepsEditor';
import { NetworkPartnersEditor } from '@/components/admin/editors/NetworkPartnersEditor';
import { FounderEditor } from '@/components/admin/editors/FounderEditor';
import { FounderHeroEditor } from '@/components/admin/editors/FounderHeroEditor';
import { FounderCredentialsEditor } from '@/components/admin/editors/FounderCredentialsEditor';
import { TextImageEditor } from '@/components/admin/editors/TextImageEditor';
import { CtaBlockEditor } from '@/components/admin/editors/CtaBlockEditor';
import { QuoteEditor } from '@/components/admin/editors/QuoteEditor';
import { FmpIntroEditor } from '@/components/admin/editors/FmpIntroEditor';
import { ServiceDetailEditor } from '@/components/admin/editors/ServiceDetailEditor';
import type { SectionEditorProps } from '@/components/admin/editors/types';
import { SaveButton } from '@/components/admin/SaveButton';
import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import { StyleEditor } from '@/components/admin/StyleEditor';
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
  founder_hero: FounderHeroEditor,
  founder_credentials: FounderCredentialsEditor,
  text_image: TextImageEditor,
  cta_block: CtaBlockEditor,
  quote: QuoteEditor,
  fmp_intro: FmpIntroEditor,
  service_detail: ServiceDetailEditor,
};

/**
 * The centre pane: one section's editor, with its own Save header.
 *
 * Parity Phase 3 (FMP CMS_REFERENCE.md section 3): FMP gives every section its
 * own Save rather than one global button for the page, so the editing surface
 * owns the control that commits it. The Save button is green via the Phase 2
 * SaveButton, and is disabled (grey) until this section actually has changes.
 */
export function SectionEditorPanel({
  sectionType,
  content,
  onChange,
  styles,
  onStylesChange,
  sectionLabel,
  visible,
  dirty,
  saveState,
  saveError,
  onSave,
}: {
  sectionType: string;
  content: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  styles: Record<string, unknown>;
  onStylesChange: (next: Record<string, unknown>) => void;
  sectionLabel: string;
  visible: boolean;
  dirty: boolean;
  saveState: SaveState;
  saveError?: string;
  onSave: () => void;
}) {
  const Editor = EDITORS[sectionType];

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: ADMIN_COLORS.textMuted,
            }}
          >
            Editing
          </p>
          <p
            style={{
              margin: '2px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            {sectionLabel}
            {!visible && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: '#F3F4F6',
                  color: ADMIN_COLORS.textMuted,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Hidden
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dirty && saveState !== 'saving' && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: ADMIN_COLORS.warning,
              }}
            >
              Unsaved
            </span>
          )}
          <SaveStatus state={saveState} message={saveError} />
          <SaveButton
            type="button"
            onClick={onSave}
            saving={saveState === 'saving'}
            disabled={!dirty}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save section'}
          </SaveButton>
        </div>
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <SectionEditorBody
          sectionType={sectionType}
          content={content}
          onChange={onChange}
          Editor={Editor}
        />
      </div>

      {/* Available for every section type, including ones whose content editor
          has not been built, because styles live on the row rather than in the
          type-specific content shape. */}
      <StyleEditor styles={styles} onChange={onStylesChange} />
    </>
  );
}

function SectionEditorBody({
  sectionType,
  content,
  onChange,
  Editor,
}: {
  sectionType: string;
  content: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  Editor?: (props: SectionEditorProps) => React.ReactElement;
}) {
  const meta = getSectionMeta(sectionType);

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
