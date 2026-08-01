import type { CSSProperties } from 'react';

import { isBlankHtml, sanitizeInlineHtml } from '@/lib/cms/sanitize';

/**
 * Renders a short operator-authored rich text value (admin RichTextarea).
 *
 * Backwards compatible by construction: a legacy plain-text value such as
 * "Advisory from structure to exit" contains no tags, so sanitising it returns
 * the same string and it renders exactly as it did when the field was a plain
 * textarea. An upgraded value like "<p>Advisory <strong>from</strong> ...</p>"
 * renders with its formatting.
 *
 * Renders nothing at all when the value is blank or holds only an empty
 * paragraph, which is what clearing a rich text field produces.
 */
export function RichText({
  html,
  as: Tag = 'span',
  className,
  style,
}: {
  html: string | null | undefined;
  as?: 'span' | 'div' | 'p';
  className?: string;
  style?: CSSProperties;
}) {
  if (isBlankHtml(html)) return null;
  return (
    <Tag
      className={className}
      style={style}
      // Sanitised immediately above through an allowlist that permits only
      // inline formatting, safe link schemes, and colour/size/alignment styles.
      dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(html) }}
    />
  );
}
