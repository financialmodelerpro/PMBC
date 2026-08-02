/**
 * Typography normalisation for operator-authored HTML.
 *
 * Separate from lib/cms/sanitize.ts on purpose: that module is about security,
 * this one is about rhythm. They compose, and the composition happens in
 * `sanitizeRichHtml`, which is the single function every long-form render site
 * already calls.
 *
 * The problem this solves. Word, Google Docs and TipTap all express a blank
 * line between paragraphs as an empty `<p></p>`. That is redundant here:
 * `.pmbc-prose p` already carries a bottom margin, so an empty paragraph adds a
 * second gap on top of the real one. Worse, authors are not consistent about
 * it, so a pasted document ends up with some boundaries separated by one margin
 * and others by two, and the column loses its rhythm. Dropping the empty
 * paragraphs makes every boundary identical, which is what "six paragraphs in,
 * six paragraphs out" actually requires.
 *
 * An earlier attempt gave `p:empty` a line of height in CSS. That was the wrong
 * fix: it stacked a full line box on top of both adjoining margins and made the
 * gaps larger still.
 */

/**
 * True when a paragraph's inner HTML would render as nothing.
 *
 * Void elements are checked first: a paragraph holding only an image has no
 * text but is very much not empty, and stripping it would delete content.
 */
function isVisuallyEmpty(inner: string): boolean {
  if (/<(img|hr|iframe|video|audio|svg|canvas|object|embed)\b/i.test(inner)) {
    return false;
  }
  const text = inner
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/ /g, ' ')
    .trim();
  return text.length === 0;
}

/**
 * Removes paragraphs that render as nothing.
 *
 * `<p>` cannot nest, so matching lazily to the first `</p>` is safe here and
 * avoids needing a parser. Runs after sanitisation, which means Word's `<o:p>`
 * and friends are already gone and only allowlisted tags remain.
 *
 * Deliberately total rather than "collapse runs to one": a single leftover
 * empty paragraph would still double one gap, which is the defect being fixed.
 * Authors wanting a deliberate visual break have `<hr>`, which is allowlisted
 * and styled.
 */
export function collapseEmptyParagraphs(html: string): string {
  if (!html || !html.includes('<p')) return html;
  return html.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (match, inner: string) =>
    isVisuallyEmpty(inner) ? '' : match,
  );
}

/**
 * Walks a JSONB blob and normalises every string that looks like rich text.
 *
 * Used on the save path for `page_sections.content`, whose shape varies by
 * section type (`html`, `bio_html`, `body_html`, `description_html`, and so
 * on), so naming the keys would mean maintaining a list that silently rots as
 * section types are added.
 *
 * Safe on anything: a string with no empty paragraph comes back identical, and
 * a string with no `<p` at all is returned untouched without being parsed.
 */
export function normalizeRichTextDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return collapseEmptyParagraphs(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeRichTextDeep(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeRichTextDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
