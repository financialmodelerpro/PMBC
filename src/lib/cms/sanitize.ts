import sanitizeHtml from 'sanitize-html';

/**
 * Allowlist sanitiser for operator-authored HTML.
 *
 * Introduced in admin parity Phase 6, which made short fields (subtitles,
 * quotes, card blurbs) rich text. Those fields previously rendered as plain
 * text nodes, so turning them into HTML would have grown the unsanitised
 * surface. Everything Phase 6 converts goes through here.
 *
 * This is the helper described in MIGRATION_PLAN.md Phase B. That phase also
 * covers the 8 pre-existing dangerouslySetInnerHTML sites (article body, case
 * study body, team bio, founder bio, paragraphs, text_image, service detail,
 * fmp_intro), which are NOT routed through here yet: converting them needs the
 * before-and-after render diff described in risk R3, and doing it inside this
 * phase would bury that check in an unrelated diff.
 *
 * Tag sets are deliberately narrow. `richInline` is what RichTextarea can
 * produce; `richBlock` adds the block structure RichTextEditor can produce.
 */

const INLINE_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'a', 'br', 'span'];

const BLOCK_TAGS = [
  ...INLINE_TAGS,
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'img',
  'figure',
  'figcaption',
];

/** Inline style is allowed only for the colour and size the editor can set. */
const ALLOWED_STYLES = {
  '*': {
    color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
    'font-size': [/^\d{1,3}px$/],
    'text-align': [/^(left|right|center|justify)$/],
  },
} as const;

const BASE: sanitizeHtml.IOptions = {
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  // Relative paths stay usable for images uploaded to our own buckets.
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // Any link that opens a new tab must not hand the opener over.
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target
        ? { ...attribs, rel: 'noopener noreferrer' }
        : attribs,
    }),
  },
};

/**
 * For short fields. Strips block structure, so a pasted heading collapses to
 * its text rather than breaking a card layout.
 */
export function sanitizeInlineHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    ...BASE,
    allowedTags: INLINE_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
    },
    allowedStyles: ALLOWED_STYLES as unknown as sanitizeHtml.IOptions['allowedStyles'],
  });
}

/** For long-form body copy produced by the full RichTextEditor. */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    ...BASE,
    allowedTags: BLOCK_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['style'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
    },
    allowedStyles: ALLOWED_STYLES as unknown as sanitizeHtml.IOptions['allowedStyles'],
  });
}

/**
 * True when the value carries no visible text once tags are removed. Lets a
 * renderer skip a field that holds only an empty paragraph, which is what an
 * emptied rich text field serialises to.
 */
export function isBlankHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim() === '';
}
