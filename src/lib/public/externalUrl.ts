/**
 * Making a user-entered external link safe to put in an href.
 *
 * Ported from FMP's `src/shared/utils/externalUrl.ts`, deliberately, because
 * the bug it exists to prevent is one FMP already shipped and fixed: people
 * paste "www.linkedin.com/in/name" with no scheme, a bare host in an href is a
 * **relative path**, and the browser resolves it against the current site. FMP
 * ended up with links to `learn.financialmodelerpro.com/www.linkedin.com/in/...`
 * on live profiles. PMBC is about to start accepting LinkedIn URLs typed by
 * clients into a public form, which is exactly the same input.
 *
 * Applied at both ends, as FMP does: on submit so what is stored is clean, and
 * at render so a row stored before this existed still links correctly without a
 * data migration.
 */

/** Schemes that must never reach an href we render. */
const DANGEROUS = /^(javascript|data|vbscript|file):/i;

/** Already carries an http(s) scheme. */
const HAS_HTTP = /^https?:\/\//i;

/** Any scheme at all, so "mailto:" and friends can be refused. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function safeParse(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Returns an absolute http(s) URL, or null for anything that cannot become one.
 *
 * Null rather than a best guess: a caller that gets null renders no link at
 * all, which is better than a link pointing back at this site. A bare handle
 * like "ahmaddin" is therefore refused, since `https://ahmaddin` is not a
 * profile and guessing which network it belongs to is not this function's job.
 */
export function normaliseExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // People paste links wrapped in angle brackets or quotes out of an email.
  const cleaned = trimmed.replace(/^[<"']+/, '').replace(/[>"']+$/, '').trim();
  if (!cleaned) return null;

  if (DANGEROUS.test(cleaned)) return null;
  if (HAS_HTTP.test(cleaned)) return safeParse(cleaned);
  if (cleaned.startsWith('//')) return safeParse('https:' + cleaned);
  if (HAS_SCHEME.test(cleaned)) return null;

  // A bare host or host/path. The first segment has to look like a domain, so a
  // stray handle is refused rather than turned into https://handle.
  const firstSegment = cleaned.split('/')[0];
  if (!firstSegment.includes('.')) return null;
  return safeParse('https://' + cleaned);
}

/**
 * The same, but only accepting a LinkedIn address.
 *
 * Used on the testimonial form, where the field is labelled LinkedIn and a URL
 * for anywhere else is more likely a mistake than an intention. Accepts any
 * linkedin.com host, including the country subdomains people are often on
 * (uk.linkedin.com, sa.linkedin.com).
 */
export function normaliseLinkedInUrl(raw: string | null | undefined): string | null {
  const url = normaliseExternalUrl(raw);
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return url;
    return null;
  } catch {
    return null;
  }
}
