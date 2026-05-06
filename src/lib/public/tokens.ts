/**
 * Public-site design tokens. Mirrors the CSS custom properties declared in
 * src/app/globals.css. Keep these in sync.
 *
 * Use the CSS variables (`var(--pmbc-...)`) inside Tailwind class strings
 * (`bg-[color:var(--pmbc-primary-deep)]`) or these literal values inside
 * inline styles when a Tailwind arbitrary value is awkward.
 */
export const PMBC = {
  primary: '#153D64',
  primaryDeep: '#0F2F4F',
  secondary: '#3FA663',
  accent: '#D4A93A',
  accentMuted: '#B89530',
  text: '#0F1B2D',
  textOnDark: '#E8DDC4',
  muted: '#6B7280',
  surface: '#FFFFFF',
  surfaceCream: '#FAF7F2',
  border: '#E5E7EB',
  borderWarm: '#E8E2D6',
} as const;

export type PmbcVariant = 'navy_deep' | 'cream' | 'white';

export function variantStyles(variant: PmbcVariant) {
  switch (variant) {
    case 'navy_deep':
      return {
        bg: PMBC.primaryDeep,
        text: '#FFFFFF',
        textMuted: PMBC.textOnDark,
        eyebrow: PMBC.accent,
        border: 'rgba(232, 221, 196, 0.18)',
        cardBg: 'rgba(255, 255, 255, 0.03)',
        cardBorder: 'rgba(232, 221, 196, 0.18)',
      };
    case 'cream':
      return {
        bg: PMBC.surfaceCream,
        text: PMBC.text,
        textMuted: '#52606B',
        eyebrow: PMBC.accentMuted,
        border: PMBC.borderWarm,
        cardBg: '#FFFFFF',
        cardBorder: PMBC.borderWarm,
      };
    case 'white':
    default:
      return {
        bg: PMBC.surface,
        text: PMBC.text,
        textMuted: '#52606B',
        eyebrow: PMBC.accentMuted,
        border: PMBC.border,
        cardBg: PMBC.surfaceCream,
        cardBorder: PMBC.borderWarm,
      };
  }
}

export function readVariant(
  styles: unknown,
  fallback: PmbcVariant,
): PmbcVariant {
  if (styles && typeof styles === 'object' && !Array.isArray(styles)) {
    const v = (styles as Record<string, unknown>).background_variant;
    if (v === 'navy_deep' || v === 'cream' || v === 'white') return v;
  }
  return fallback;
}
