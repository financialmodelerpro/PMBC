import type { Metadata } from 'next';

import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchFmpPage } from './client';
import type { FmpSlug } from './types';

/**
 * The three imported pages, in one place.
 *
 * Each carries PMBC's own fallback copy alongside the FMP slug. That copy is
 * doing real work rather than being defensive padding: FMP's `seo_title` and
 * `seo_description` are empty strings for all three published pages, so the
 * feed supplies a page title and nothing else. Metadata that relied on the feed
 * alone would ship three pages with PMBC's default site description.
 */
export const FMP_PAGES: Record<
  FmpSlug,
  {
    /** PMBC's path. */
    path: string;
    /** The matching path on FMP, for the link out. */
    fmpPath: string;
    /** Used when the feed's title is empty, and as the fallback page heading. */
    title: string;
    description: string;
    ogSubtitle: string;
    intro: string;
  }
> = {
  'modeling-hub': {
    path: '/financial-modeler-pro/modeling-hub',
    fmpPath: '/modeling',
    title: 'Modeling Hub',
    description:
      'The Modeling Hub on Financial Modeler Pro: structured, guided financial modeling workflows built by a practitioner, with formula-linked Excel and investor-ready PDF outputs.',
    ogSubtitle: 'Institutional-grade models, built the way deals are structured',
    intro:
      'Structured, guided financial modeling workflows built from live advisory work, with traceable calculations and presentation-ready outputs.',
  },
  refm: {
    path: '/financial-modeler-pro/refm',
    fmpPath: '/modeling/real-estate',
    title: 'Real Estate Financial Modeling',
    description:
      'Real Estate Financial Modeling on Financial Modeler Pro: development feasibility from land acquisition through financing to exit, for multi-asset residential, hospitality and retail projects.',
    ogSubtitle: 'Development feasibility, from land to exit',
    intro:
      'Institutional-grade development feasibility for multi-asset projects, from project setup and land through financing to investor returns.',
  },
  'training-hub': {
    path: '/financial-modeler-pro/training-hub',
    fmpPath: '/training',
    title: 'Training Hub',
    description:
      'The Training Hub on Financial Modeler Pro: free financial modeling certification with assessed sessions and verifiable certificates.',
    ogSubtitle: 'Assessed financial modeling certification, free',
    intro:
      'Free, assessed financial modeling certification with verifiable certificates, built on the same practitioner material as the advisory practice.',
  },
};

/**
 * Metadata for an imported page.
 *
 * Prefers the feed's own values and falls back per field rather than
 * wholesale, because the feed supplies a usable `title` and an empty
 * `meta_description`, so an all-or-nothing choice would either discard FMP's
 * page title or ship an empty description.
 *
 * `og_image_url` is null from FMP by design, so nothing is passed through for
 * it and `buildPageMetadata` routes these pages to PMBC's own /api/og.
 */
export async function buildFmpPageMetadata(slug: FmpSlug): Promise<Metadata> {
  const config = FMP_PAGES[slug];
  const result = await fetchFmpPage(slug);

  const feedTitle = result.ok ? result.payload.page.meta_title.trim() || result.payload.page.title.trim() : '';
  const feedDescription = result.ok ? result.payload.page.meta_description.trim() : '';

  const title = feedTitle || config.title;

  return buildPageMetadata({
    path: config.path,
    fallback: {
      // The brand suffix is added here because buildPageMetadata sets the title
      // absolutely, bypassing the root template.
      title: `${title} | PaceMakers Business Consultants`,
      description: feedDescription || config.description,
      ogSubtitle: config.ogSubtitle,
    },
  });
}
