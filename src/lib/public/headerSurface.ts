import { PMBC } from './tokens';

/**
 * The background the header sits on, chosen in Header Settings.
 *
 * The three names are the ones `PmbcVariant` already uses for section
 * backgrounds, deliberately: an operator meets white, cream and deep navy in the
 * page builder's style panel, and a header offering a different vocabulary for
 * the same three surfaces would read as a different kind of choice than it is.
 *
 * A free hex field was considered and rejected. Every value below the surface
 * itself (link colour, CTA treatment, the mobile panel) has to change with it,
 * and those cannot be derived from an arbitrary colour without guessing at
 * contrast. Three surfaces the palette already owns are three surfaces that are
 * known to work.
 */
export type HeaderBackground = 'white' | 'cream' | 'navy_deep';

export const HEADER_BACKGROUNDS: {
  value: HeaderBackground;
  label: string;
  hint: string;
}[] = [
  { value: 'white', label: 'White', hint: 'The default. Matches the white sections.' },
  {
    value: 'cream',
    label: 'Cream',
    hint: 'The warm surface used by every other section. Softer behind a navy and green logo.',
  },
  {
    value: 'navy_deep',
    label: 'Deep navy',
    hint: 'The footer colour. Uses the light logo and turns the CTA gold. Note that heroes are navy, so the header and the hero below it will read as one block.',
  },
];

export const DEFAULT_HEADER_BACKGROUND: HeaderBackground = 'white';

export function readHeaderBackground(raw: unknown): HeaderBackground {
  if (raw === 'white' || raw === 'cream' || raw === 'navy_deep') return raw;
  return DEFAULT_HEADER_BACKGROUND;
}

/**
 * Every colour the header needs, resolved from the chosen background.
 *
 * Written out per surface rather than derived from a lightness test. The values
 * are design decisions, not arithmetic: the CTA goes gold on navy because a navy
 * button on a navy header is invisible, and the monogram inverts for the same
 * reason. A generated palette would get both wrong in a way that is hard to see
 * until it ships.
 */
export type HeaderSurface = {
  /** True when the header needs light text and the logo for dark backgrounds. */
  dark: boolean;
  bg: string;
  /** Slightly translucent, used once the page has scrolled under the header. */
  bgScrolled: string;
  shadowScrolled: string;
  borderScrolled: string;

  link: string;
  linkActive: string;
  /** The dropdown chevron, which sits quieter than the label beside it. */
  linkMuted: string;

  wordmark: string;
  tagline: string;
  monogramBg: string;
  monogramText: string;

  ctaBg: string;
  ctaBorder: string;
  ctaText: string;
  ctaHoverBg: string;
  ctaHoverBorder: string;

  toggleText: string;
  toggleBorder: string;

  menuBg: string;
  menuBorder: string;
  menuText: string;
  menuActiveText: string;
  menuChildText: string;
  menuChildBorder: string;
};

const LIGHT_SHARED = {
  dark: false,
  shadowScrolled: '0 2px 12px rgba(15, 37, 64, 0.06)',
  borderScrolled: 'rgba(198, 156, 62, 0.18)',
  link: PMBC.text,
  linkActive: PMBC.primary,
  linkMuted: PMBC.muted,
  wordmark: PMBC.primaryDeep,
  tagline: PMBC.muted,
  monogramBg: PMBC.primary,
  monogramText: PMBC.accent,
  ctaBg: PMBC.primary,
  ctaBorder: PMBC.primary,
  ctaText: '#FFFFFF',
  ctaHoverBg: PMBC.primaryDeep,
  ctaHoverBorder: PMBC.accent,
  toggleText: PMBC.primaryDeep,
  menuText: PMBC.text,
  menuActiveText: PMBC.primary,
  menuChildText: '#52606B',
  menuChildBorder: 'rgba(198, 156, 62, 0.35)',
} as const;

const SURFACES: Record<HeaderBackground, HeaderSurface> = {
  white: {
    ...LIGHT_SHARED,
    bg: PMBC.surface,
    bgScrolled: 'rgba(255, 255, 255, 0.95)',
    toggleBorder: PMBC.border,
    // The mobile panel stays cream under a white header, which is what it
    // shipped as: it needs to separate from the header above it.
    menuBg: PMBC.surfaceCream,
    menuBorder: PMBC.borderWarm,
  },
  cream: {
    ...LIGHT_SHARED,
    bg: PMBC.surfaceCream,
    bgScrolled: 'rgba(250, 247, 242, 0.95)',
    toggleBorder: PMBC.borderWarm,
    // And white under a cream header, for the same reason in reverse. Cream on
    // cream would leave the open menu indistinguishable from the bar above it.
    menuBg: PMBC.surface,
    menuBorder: PMBC.borderWarm,
  },
  navy_deep: {
    dark: true,
    bg: PMBC.primaryDeep,
    bgScrolled: 'rgba(20, 48, 79, 0.95)',
    shadowScrolled: '0 2px 12px rgba(0, 0, 0, 0.25)',
    borderScrolled: 'rgba(232, 221, 196, 0.28)',
    link: PMBC.textOnDark,
    linkActive: PMBC.accent,
    linkMuted: 'rgba(232, 221, 196, 0.7)',
    wordmark: '#FFFFFF',
    tagline: 'rgba(232, 221, 196, 0.75)',
    monogramBg: PMBC.accent,
    monogramText: PMBC.primaryDeep,
    ctaBg: PMBC.accent,
    ctaBorder: PMBC.accent,
    ctaText: PMBC.primaryDeep,
    ctaHoverBg: PMBC.textOnDark,
    ctaHoverBorder: PMBC.textOnDark,
    toggleText: PMBC.textOnDark,
    toggleBorder: 'rgba(232, 221, 196, 0.28)',
    menuBg: PMBC.primary,
    menuBorder: 'rgba(232, 221, 196, 0.18)',
    menuText: PMBC.textOnDark,
    menuActiveText: '#FFFFFF',
    menuChildText: 'rgba(232, 221, 196, 0.75)',
    menuChildBorder: 'rgba(198, 156, 62, 0.5)',
  },
};

export function headerSurface(background: HeaderBackground): HeaderSurface {
  return SURFACES[background] ?? SURFACES[DEFAULT_HEADER_BACKGROUND];
}
