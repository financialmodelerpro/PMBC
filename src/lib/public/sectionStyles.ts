/**
 * Per-section presentation overrides, edited in the admin StyleEditor and stored
 * in `page_sections.styles` (parity Phase 5, FMP CMS_REFERENCE.md section 2.3a).
 *
 * Relationship to the variant system introduced in Phase 9.5: the variant
 * (`navy_deep` / `cream` / `white`) still decides the section's default
 * background, text and eyebrow colours, and the sequence-aware rhythm in
 * SectionRenderer is untouched. These overrides sit ON TOP: any field left blank
 * falls through to the variant, so an empty or absent `styles` object renders
 * exactly as it did before this feature existed.
 *
 * `background_variant` and the legacy `background_style` are deliberately NOT
 * part of this type. They are read by SectionRenderer to pick the variant and
 * must keep working untouched.
 */

export type SectionAnimation = 'none' | 'fade-in' | 'slide-up';

export type SectionStyleOverrides = {
  bgColor: string | null;
  bgImageUrl: string | null;
  /** 0 to 100. Only meaningful alongside bgImageUrl. */
  bgOverlay: number | null;
  textColor: string | null;
  paddingTop: number | null;
  paddingRight: number | null;
  paddingBottom: number | null;
  paddingLeft: number | null;
  maxWidth: number | null;
  borderRadius: number | null;
  animation: SectionAnimation;
  cssClass: string | null;
};

export const EMPTY_SECTION_STYLES: SectionStyleOverrides = {
  bgColor: null,
  bgImageUrl: null,
  bgOverlay: null,
  textColor: null,
  paddingTop: null,
  paddingRight: null,
  paddingBottom: null,
  paddingLeft: null,
  maxWidth: null,
  borderRadius: null,
  animation: 'none',
  cssClass: null,
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Conservative: a CSS class list, so nothing can break out of the attribute. */
const CSS_CLASS = /^[A-Za-z0-9_ -]{1,120}$/;

function hex(v: unknown): string | null {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : null;
}

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

/**
 * Only http(s) and root-relative paths. A `javascript:` or `data:` URL in a
 * CSS url() is not the same class of hole as an href, but this value is
 * operator-supplied and interpolated into a style attribute, so it is validated
 * rather than trusted.
 */
function imageUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (/[)"'\\]/.test(s)) return null; // cannot break out of url("...")
  if (s.startsWith('/')) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

export function parseSectionStyles(styles: unknown): SectionStyleOverrides {
  if (!styles || typeof styles !== 'object' || Array.isArray(styles)) {
    return EMPTY_SECTION_STYLES;
  }
  const s = styles as Record<string, unknown>;
  const animation = s.animation;

  return {
    bgColor: hex(s.bg_color),
    bgImageUrl: imageUrl(s.bg_image_url),
    bgOverlay: num(s.bg_overlay, 0, 100),
    textColor: hex(s.text_color),
    paddingTop: num(s.padding_top, 0, 200),
    paddingRight: num(s.padding_right, 0, 200),
    paddingBottom: num(s.padding_bottom, 0, 200),
    paddingLeft: num(s.padding_left, 0, 200),
    maxWidth: num(s.max_width, 320, 2400),
    borderRadius: num(s.border_radius, 0, 24),
    animation:
      animation === 'fade-in' || animation === 'slide-up' ? animation : 'none',
    cssClass:
      typeof s.css_class === 'string' && CSS_CLASS.test(s.css_class.trim())
        ? s.css_class.trim()
        : null,
  };
}

/** True when nothing is set, so callers can skip the override work entirely. */
export function hasAnyOverride(o: SectionStyleOverrides): boolean {
  return (
    o.bgColor !== null ||
    o.bgImageUrl !== null ||
    o.textColor !== null ||
    o.paddingTop !== null ||
    o.paddingRight !== null ||
    o.paddingBottom !== null ||
    o.paddingLeft !== null ||
    o.maxWidth !== null ||
    o.borderRadius !== null ||
    o.animation !== 'none' ||
    o.cssClass !== null
  );
}

/**
 * Inline styles for the section's outer element.
 *
 * Background precedence, most specific first:
 *   1. image (+ optional darkening overlay)
 *   2. flat colour
 *   3. nothing, so the variant background already on the element stands
 */
export function sectionOuterStyle(o: SectionStyleOverrides): React.CSSProperties {
  const style: React.CSSProperties = {};

  if (o.bgImageUrl) {
    const overlay = o.bgOverlay !== null ? o.bgOverlay / 100 : 0;
    const layers: string[] = [];
    if (overlay > 0) {
      const rgba = `rgba(0,0,0,${overlay})`;
      layers.push(`linear-gradient(${rgba}, ${rgba})`);
    }
    layers.push(`url("${o.bgImageUrl}")`);
    style.backgroundImage = layers.join(', ');
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
    if (o.bgColor) style.backgroundColor = o.bgColor;
  } else if (o.bgColor) {
    style.background = o.bgColor;
  }

  if (o.textColor) style.color = o.textColor;
  if (o.paddingTop !== null) style.paddingTop = o.paddingTop;
  if (o.paddingRight !== null) style.paddingRight = o.paddingRight;
  if (o.paddingBottom !== null) style.paddingBottom = o.paddingBottom;
  if (o.paddingLeft !== null) style.paddingLeft = o.paddingLeft;
  if (o.borderRadius !== null) style.borderRadius = o.borderRadius;

  return style;
}

/** Inline styles for the inner max-width wrapper. */
export function sectionInnerStyle(o: SectionStyleOverrides): React.CSSProperties {
  return o.maxWidth !== null ? { maxWidth: o.maxWidth } : {};
}

/**
 * Extra classes for the outer element: the operator's own class plus the
 * animation class. Animations are defined in globals.css and are disabled under
 * prefers-reduced-motion.
 */
export function sectionOuterClassName(o: SectionStyleOverrides): string {
  const out: string[] = [];
  if (o.animation === 'fade-in') out.push('pmbc-anim-fade-in');
  if (o.animation === 'slide-up') out.push('pmbc-anim-slide-up');
  if (o.cssClass) out.push(o.cssClass);
  return out.join(' ');
}
