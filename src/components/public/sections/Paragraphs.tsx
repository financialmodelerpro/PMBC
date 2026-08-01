import { SectionContainer } from '../SectionContainer';
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
  if (!html) return null;
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';
  return (
    <SectionContainer variant={variant} styles={styles} size="compact">
      <div
        className={
          'prose mx-auto max-w-[780px] ' + (dark ? 'prose-invert' : 'prose-neutral')
        }
        style={{
          color: dark ? '#E8DDC4' : v.text,
          fontSize: 17,
          lineHeight: 1.75,
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
      />
    </SectionContainer>
  );
}
