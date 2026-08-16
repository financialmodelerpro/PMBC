import { SectionContainer, SectionIntro } from '../SectionContainer';
import { isBlankHtml, sanitizeRichHtml } from '@/lib/cms/sanitize';
import { PROSE_MEASURE, proseAlignClass, readProseAlign } from '@/lib/public/prose';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';

export function Paragraphs({
  content,
  styles,
  variant = 'white',
  media = null,
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
  media?: SectionMediaValue | null;
}) {
  const html = typeof content?.html === 'string' ? content.html : '';
  // Optional heading, added for the founder profile's Background / Why
  // PaceMakers / Market Focus / Personal blocks. Existing paragraphs sections
  // carry no heading key, so they render exactly as before.
  const heading = typeof content?.heading === 'string' ? content.heading : '';
  // Optional eyebrow, added 2026-08-16 for the /services engagement block.
  // Same contract as the heading above it: a section without the key renders
  // exactly as it did, and `SectionIntro` has always accepted one.
  const eyebrow = typeof content?.eyebrow === 'string' ? content.eyebrow.trim() : '';
  const align = readProseAlign(content?.align);
  // `isBlankHtml` rather than a falsy check: an emptied rich text field
  // serialises to "<p></p>", which is truthy but renders as nothing once the
  // empty paragraphs are dropped. Without this the section would contribute its
  // padding and heading to the page for no visible content.
  if (isBlankHtml(html)) return null;
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant} styles={styles} size="compact" media={media}>
      {/* The section background and its padding stay full-container width; only
          this text column narrows, so long-form copy holds a readable measure
          rather than running the full 1200px. */}
      <div className="mx-auto" style={{ maxWidth: PROSE_MEASURE }}>
        {(eyebrow || heading) && (
          <div className="mb-9">
            <SectionIntro
              eyebrow={eyebrow}
              headline={heading}
              variant={variant}
              align="left"
            />
          </div>
        )}
        <div
          className={[
            'pmbc-prose',
            dark ? 'pmbc-prose-invert' : '',
            proseAlignClass(align),
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            color: dark ? '#E8DDC4' : v.text,
            fontSize: 17,
            lineHeight: 1.75,
            // text-align inherits, so this reaches every paragraph and list
            // item. An inline text-align the operator set on one paragraph in
            // the rich text editor still wins, which is the right precedence.
            textAlign: align,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
        />
      </div>
    </SectionContainer>
  );
}
