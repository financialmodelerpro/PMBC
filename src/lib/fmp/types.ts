/**
 * The contract PMBC consumes from FMP's public feed.
 *
 * Mirrors `GET /api/public/pages/{slug}` on app.financialmodelerpro.com, read
 * from that route's source rather than inferred from a sample response, so the
 * optional and nullable fields here are the ones the producer actually
 * declares.
 *
 * `og_image_url` is typed as nullable and is null in practice: FMP has no
 * per-page OG column. PMBC falls back to its own /api/og for these pages.
 *
 * `meta_title` and `meta_description` are typed as strings but are EMPTY for
 * all three published pages today, because FMP's `cms_pages.seo_title` and
 * `seo_description` are blank for them. Anything reading them has to have a
 * fallback, not merely a null check.
 */

export type FmpSection = {
  section_type: string;
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  display_order: number;
};

export type FmpPagePayload = {
  version: number;
  page: {
    slug: string;
    title: string;
    meta_title: string;
    meta_description: string;
    og_image_url: string | null;
    status: string;
    updated_at: string | null;
  };
  sections: FmpSection[];
};

/** The three slugs FMP's whitelist serves. Anything else is a 404 there. */
export const FMP_SLUGS = ['modeling-hub', 'refm', 'training-hub'] as const;
export type FmpSlug = (typeof FMP_SLUGS)[number];

export function isFmpSlug(value: string): value is FmpSlug {
  return (FMP_SLUGS as readonly string[]).includes(value);
}

/** Where a rendered payload came from, so a page can say so if it needs to. */
export type FmpSource = 'live' | 'cache';

export type FmpFetchResult =
  | { ok: true; payload: FmpPagePayload; source: FmpSource; ageSeconds: number | null }
  | { ok: false; reason: 'not_configured' | 'unavailable' | 'not_found'; detail: string };
