/**
 * The firm's letterhead colours and legal line, shared by every tool PDF
 * report (`src/lib/tools/pdf/theme.ts`) and the tool emails
 * (`src/lib/email/templates/_base.ts`, the report variant).
 *
 * Sampled from `reference/brand/PMBC_Letterhead.pdf` on 2026-09-17, from its
 * vector fill operators and a 3x render, and confirmed against the Header
 * Settings logo file, which uses the same navy, green and gold exactly. Do not
 * retune without resampling the letterhead.
 *
 * The website keeps its own tokens (#1B3A5F, #3FA663, #C69C3E) in
 * `src/app/globals.css`; this palette is for reports and report emails.
 *
 * Pure and dependency free.
 */

export const BRAND = {
  /** The letterhead bands, contact labels, the logo wordmark. */
  navy: '#153D64',
  /** The swoosh, the logo's "Business Consultants". */
  green: '#2E8B3A',
  /** The darker shade inside the swoosh. */
  greenDeep: '#1E5825',
  /** The tagline and the logo ring. Used minimally. */
  gold: '#C9A227',
  /** The letterhead's legal and contact text. */
  grey: '#595959',
} as const;

/** Neutrals chosen to sit quietly beside the brand colours. */
export const NEUTRALS = {
  text: '#1F2933',
  border: '#DCE1E6',
  shade: '#F3F5F7',
  greenTint: '#EAF3EC',
  navyTint: '#E8EDF3',
  warning: '#B3412F',
  white: '#FFFFFF',
} as const;

/**
 * The firm's registration, stated once in each report and in the report email
 * footer. The letterhead itself prints "LLP Act, 2007"; the Act is the Limited
 * Liability Partnership Act, 2017, as the site's legal pages say.
 */
export const LEGAL_LINE =
  'PaceMakers Business Consultants LLP, a Limited Liability Partnership registered with the SECP under section 7 of the Limited Liability Partnership Act, 2017.';

/** The live website address, as reports and report emails print it. Never taken from the environment, so a local render cannot print localhost. */
export const SITE_HREF = 'https://www.pacemakersglobal.com';
/** Printed in full, scheme included, so a reader can type it or tap it as it stands. */
export const SITE_ADDRESS = SITE_HREF;

export const DEFAULT_BRAND_NAME = 'PaceMakers Business Consultants';
export const DEFAULT_TAGLINE = 'Advisory from Structure to Exit';
