import sanitizeHtml from 'sanitize-html';

import { collapseEmptyParagraphs } from './richText';

/**
 * Allowlist sanitiser for operator-authored HTML.
 *
 * Introduced in admin parity Phase 6, which made short fields (subtitles,
 * quotes, card blurbs) rich text. Those fields previously rendered as plain
 * text nodes, so turning them into HTML would have grown the unsanitised
 * surface. Everything Phase 6 converts goes through here.
 *
 * This is the helper described in MIGRATION_PLAN.md Phase B. Phase 6.5 completed
 * that work: every remaining site now routes through here, so no operator HTML
 * reaches a browser unsanitised.
 *
 * Deliberately NOT sanitised, and correctly so: the two JSON-LD blocks in
 * components/seo/. Those interpolate `JSON.stringify(...)` of an object we build
 * ourselves, never operator HTML, and running them through an HTML sanitiser
 * would corrupt the structured data.
 *
 * Three allowlists, narrowest first:
 *   sanitizeInlineHtml  short fields (RichTextarea): inline marks only
 *   sanitizeRichHtml    long-form body copy (RichTextEditor): adds block tags
 *   sanitizeEmailHtml   email signature and footer previews: adds table markup
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

/**
 * For long-form body copy produced by the full RichTextEditor.
 *
 * This is the render path for body copy, so it does two things: it sanitises,
 * and it then normalises paragraph rhythm by dropping paragraphs that render as
 * nothing (see lib/cms/richText.ts for why). Normalisation runs second so it
 * only ever sees allowlisted tags, with Word's `<o:p>` and friends already
 * discarded.
 *
 * Combining them here rather than exposing a separate render helper is
 * deliberate: every long-form site already calls this one function, so the two
 * behaviours cannot drift apart by someone forgetting the second call.
 */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return '';
  const clean = sanitizeHtml(html, {
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
  return collapseEmptyParagraphs(clean);
}

/**
 * For the email signature and footer previews in the admin.
 *
 * Wider than `sanitizeRichHtml` on purpose. Transactional email HTML relies on
 * table layout and inline styles for client compatibility, so applying the
 * strict body allowlist would strip markup that the real email keeps, and the
 * preview would then be lying about what actually gets sent. This permits the
 * markup email needs while still removing scripts, event handlers and unsafe
 * URL schemes, which is what protects the admin viewing the preview.
 *
 * Note this sanitises the PREVIEW only. The stored value is sent as authored by
 * lib/email, which is the correct split: the sanitiser exists to protect a
 * browser rendering the HTML, and an email client is not this codebase's
 * browser.
 */
export function sanitizeEmailHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    ...BASE,
    allowedTags: [
      ...BLOCK_TAGS,
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'td',
      'th',
      'small',
      'strike',
      'sub',
      'sup',
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'valign', 'width', 'height', 'colspan', 'rowspan'],
      a: ['href', 'target', 'rel', 'style'],
      img: ['src', 'alt', 'title', 'width', 'height', 'style'],
      table: ['cellpadding', 'cellspacing', 'border', 'role', 'style', 'width'],
    },
    // Email styling is broad by nature, so styles are allowed rather than
    // pattern-matched. `style` cannot execute script in any current browser,
    // and the tag and scheme allowlists above are what stop the real attacks.
    allowedStyles: undefined,
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
