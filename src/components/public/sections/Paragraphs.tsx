import { SectionContainer, SectionIntro } from '../SectionContainer';
import { sanitizeRichHtml } from '@/lib/cms/sanitize';
import { PROSE_MEASURE, proseAlignClass, readProseAlign } from '@/lib/public/prose';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

export function Paragraphs({
  content,
  styles,
  variant = 'white',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const html = typeof content?.html === 'string' ? content.html : '';
  // Optional heading, added for the founder profile's Background / Why
  // PaceMakers / Market Focus / Personal blocks. Existing paragraphs sections
  // carry no heading key, so they render exactly as before.
  const heading = typeof content?.heading === 'string' ? content.heading : '';
  const align = readProseAlign(content?.align);
  if (!html) return null;
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant} styles={styles} size="compact">
      {/* The section background and its padding stay full-container width; only
          this text column narrows, so long-form copy holds a readable measure
          rather than running the full 1200px. */}
      <div className="mx-auto" style={{ maxWidth: PROSE_MEASURE }}>
        {heading && (
          <div className="mb-9">
            <SectionIntro headline={heading} variant={variant} align="left" />
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
