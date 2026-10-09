import type { CSSProperties } from 'react';

import { isBlankHtml, sanitizeInlineHtml } from '@/lib/cms/sanitize';
import { PARAGRAPH_GAP, splitPlainParagraphs } from './MultilineText';

/**
 * Splits a short rich text value into its paragraphs, each still raw HTML.
 *
 * Pressing Enter in the admin RichTextarea starts a new `<p>`, but the inline
 * sanitiser discards block tags and keeps their text, so two paragraphs used
 * to render glued together ("First.Second."). Splitting here, before
 * sanitising, keeps the break. A legacy plain-text value with blank lines is
 * split the same way the plain fields are, with single newlines kept as `<br>`.
 *
 * Returns one entry for a value with one paragraph, which the caller renders
 * exactly as before. Paragraphs that render as nothing (a double Enter) are
 * dropped.
 */
export function splitHtmlParagraphs(html: string): string[] {
  const pCount = (html.match(/<p\b/gi) ?? []).length;
  if (pCount > 1) {
    return html
      .replace(/^\s*<p\b[^>]*>/i, '')
      .replace(/<\/p>\s*$/i, '')
      .split(/<\/p>\s*<p\b[^>]*>/i)
      .filter((p) => !isBlankHtml(p));
  }
  if (!html.includes('<') && /[\r\n]/.test(html)) {
    return splitPlainParagraphs(html).map((lines) => lines.join('<br>'));
  }
  return [html];
}

/**
 * Renders a short operator-authored rich text value (admin RichTextarea).
 *
 * Backwards compatible by construction: a legacy plain-text value such as
 * "Advisory from structure to exit" contains no tags, so sanitising it returns
 * the same string and it renders exactly as it did when the field was a plain
 * textarea. An upgraded value like "<p>Advisory <strong>from</strong> ...</p>"
 * renders with its formatting. A value with several paragraphs renders each as
 * a block span, spaced like the plain fields (see `MultilineText`).
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
  const paragraphs = splitHtmlParagraphs(html as string);
  if (paragraphs.length > 1) {
    return (
      <Tag className={className} style={style}>
        {paragraphs.map((p, i) => (
          <span
            key={i}
            className="block"
            style={i === 0 ? undefined : { marginTop: PARAGRAPH_GAP }}
            // Each paragraph goes through the same inline allowlist as a
            // single-paragraph value.
            dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(p) }}
          />
        ))}
      </Tag>
    );
  }
  return (
    <Tag
      className={className}
      style={style}
      // Sanitised immediately above through an allowlist that permits only
      // inline formatting, safe link schemes, and colour/size/alignment styles.
      dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(paragraphs[0]) }}
    />
  );
}
