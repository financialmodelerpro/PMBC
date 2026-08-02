import { SectionContainer, SectionIntro } from '../SectionContainer';
import { sanitizeRichHtml } from '@/lib/cms/sanitize';
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
  if (!html) return null;
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';
  return (
    <SectionContainer variant={variant} styles={styles} size="compact">
      <div className="mx-auto max-w-[780px]">
        {heading && (
          <div className="mb-9">
            <SectionIntro headline={heading} variant={variant} align="left" />
          </div>
        )}
        <div
          className={'prose max-w-none ' + (dark ? 'prose-invert' : 'prose-neutral')}
          style={{
            color: dark ? '#E8DDC4' : v.text,
            fontSize: 17,
            lineHeight: 1.75,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
        />
      </div>
    </SectionContainer>
  );
}
