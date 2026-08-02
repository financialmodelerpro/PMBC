/**
 * Maps a `cms_pages.slug` to the public URL that renders it.
 *
 * These stopped being the same thing in Phase 7, when the catch-all
 * `(public)/[slug]` route was deleted in favour of bespoke routes. Two callers
 * kept assuming `/${slug}`, which silently 404s for every slug whose route is
 * nested:
 *
 *   service-cfo-advisory  -> /services/cfo-advisory   (9 pages, broken since Phase 7)
 *   about-ahmad-din       -> /about/ahmad-din         (broken since it was added)
 *   home                  -> /
 *
 * There is no column recording the route, so the exceptions are listed here
 * rather than derived. That is the honest trade: a new nested page needs a line
 * in this file, and forgetting it produces a preview 404 rather than a broken
 * public page.
 */

/** Slugs whose public route is not simply `/${slug}`. */
const EXPLICIT_ROUTES: Record<string, string> = {
  home: '/',
  'about-ahmad-din': '/about/ahmad-din',
};

/** Service detail pages are stored as `service-<slug>` and served at `/services/<slug>`. */
const SERVICE_PREFIX = 'service-';

export function publicPathForPageSlug(slug: string): string {
  const explicit = EXPLICIT_ROUTES[slug];
  if (explicit) return explicit;
  // `services` (the overview) must not match this: it has no trailing hyphen,
  // so the prefix check below cannot catch it by accident.
  if (slug.startsWith(SERVICE_PREFIX)) {
    return `/services/${slug.slice(SERVICE_PREFIX.length)}`;
  }
  return `/${slug}`;
}

/**
 * The same path with `?preview=1`, which makes the public route include
 * sections marked hidden so an operator can see what they are working on.
 */
export function previewPathForPageSlug(slug: string): string {
  const path = publicPathForPageSlug(slug);
  return `${path}${path.includes('?') ? '&' : '?'}preview=1`;
}
