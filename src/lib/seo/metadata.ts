import type { Metadata } from 'next';

import type { CmsPage } from '@/lib/cms/pages';

export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'https://pacemakersglobal.com';
}

const BRAND = 'PaceMakers Business Consultants';
const DEFAULT_DESCRIPTION =
  'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.';

/**
 * Builds a `/api/og?…` URL with title + subtitle pre-filled. Used as the
 * automatic per-page OG fallback when `cms_pages.og_image_url` is null.
 */
export function ogImageFor({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}): string {
  const params = new URLSearchParams();
  params.set('title', title);
  if (subtitle) params.set('subtitle', subtitle);
  return `/api/og?${params.toString()}`;
}

export type BuildPageMetadataOpts = {
  /** Path WITHOUT the origin, e.g. "/about" or "/" */
  path: string;
  /** CmsPage row, if a CMS-managed page. */
  cmsPage?: CmsPage | null;
  /** Used when cmsPage is null OR for service detail routes that compose their own title. */
  fallback: { title: string; description?: string; ogSubtitle?: string };
  /** Override the OG subtitle even if a CmsPage exists. */
  ogSubtitleOverride?: string;
};

/**
 * Single source of truth for per-page metadata. Pulls title / description /
 * og_image_url from the cms_pages row when present, falls back to the
 * route-supplied defaults otherwise. Always sets a canonical URL and an OG
 * image (auto-generated via /api/og when no override is configured).
 *
 * Uses `title: { absolute: ... }` to bypass the root layout's title
 * template — `cms_pages.meta_title` already includes the brand suffix and
 * we don't want it duplicated.
 */
export function buildPageMetadata(opts: BuildPageMetadataOpts): Metadata {
  const { path, cmsPage, fallback, ogSubtitleOverride } = opts;
  const base = siteUrl();

  const title = cmsPage?.meta_title ?? fallback.title;
  const description =
    cmsPage?.meta_description ?? fallback.description ?? DEFAULT_DESCRIPTION;

  // Strip "— PaceMakers Business Consultants" from the OG title so the OG
  // card itself doesn't carry the long suffix (the wordmark on the card
  // already says PaceMakers).
  const ogTitle = title.replace(/\s*[—-]\s*PaceMakers Business Consultants\s*$/i, '');
  const ogSubtitle = ogSubtitleOverride ?? fallback.ogSubtitle ?? description;

  const ogImage = cmsPage?.og_image_url || ogImageFor({ title: ogTitle, subtitle: ogSubtitle });

  const canonical = `${base}${path === '/' ? '' : path}`;
  const absoluteOgImage = /^https?:/i.test(ogImage) ? ogImage : `${base}${ogImage}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: BRAND,
      type: 'website',
      images: [
        {
          url: absoluteOgImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteOgImage],
    },
  };
}
