import type { MetadataRoute } from 'next';

import { SERVICES } from '@/config/services';
import {
  fetchPublishedCaseStudies,
  fetchPublishedArticles,
  fetchVisibleTeam,
} from '@/lib/cms/collections';

function baseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'https://pacemakersglobal.com';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();

  const [studies, articles, team] = await Promise.all([
    fetchPublishedCaseStudies(),
    fetchPublishedArticles(),
    fetchVisibleTeam(),
  ]);

  /**
   * `/team`, `/case-studies` and `/insights` are offered to crawlers only once
   * their collection has something in it.
   *
   * All three are empty, and on 2026-08-13 their footer links were hidden, so
   * nothing on the site links to them. An index page that is unlinked and has
   * no content is a hero over an empty state: submitting it asks a crawler to
   * index nothing and gives a visitor arriving from search a worse first
   * impression than not appearing at all. The routes are untouched and still
   * return 200.
   *
   * Derived from the content rather than hardcoded out, so populating a
   * collection puts its page back in the sitemap with no code change. That is
   * also the honest coupling: what belongs in a sitemap is a question about
   * content, not about whether the footer happens to link to it today.
   *
   * These fetchers return an empty array on error, so a database problem at
   * build time drops the page for that build. That is the same soft failure the
   * detail URLs below have always had, and the alternative (submitting a page
   * that may be empty) is worse.
   */
  const collectionIndexRoutes = [
    ...(team.length > 0 ? ['/team'] : []),
    ...(studies.length > 0 ? ['/case-studies'] : []),
    ...(articles.length > 0 ? ['/insights'] : []),
  ];

  const firmRoutes = [
    '',
    '/services',
    '/sectors',
    // `/approach` is deliberately absent since its nav item was hidden. The
    // route still renders and nothing about the page changed, but it is no
    // longer part of the site's own structure, so it is not offered to
    // crawlers either. Re-adding this line and the nav item brings it back.
    '/network',
    // `/about` is gone: it was merged into the home page and now 301s there.
    // The founder profile keeps its nested path.
    '/about/ahmad-din',
    // /team, /case-studies and /insights sit here when they have content. See
    // collectionIndexRoutes above.
    ...collectionIndexRoutes,
    '/fmp',
    // The three FMP-fed sub-pages under /financial-modeler-pro are deliberately
    // absent. They still render and the API integration behind them still runs,
    // but nothing links to them and they are not offered to crawlers, so /fmp
    // is the single canonical platform page. Re-adding a line here is all it
    // takes to bring one back.
    '/contact',
    '/book',
    '/privacy',
    '/terms',
  ];

  const serviceRoutes = SERVICES.map((s) => `/services/${s.slug}`);

  const caseStudyRoutes = studies.map((s) => `/case-studies/${s.slug}`);
  const insightRoutes = articles.map((a) => `/insights/${a.slug}`);

  return [
    ...firmRoutes,
    ...serviceRoutes,
    ...caseStudyRoutes,
    ...insightRoutes,
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : path.startsWith('/services/') ? 0.7 : 0.8,
  }));
}
