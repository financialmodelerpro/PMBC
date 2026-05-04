import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchPages } from '@/lib/cms/pages';
import { adminPageMain } from '@/lib/admin/styles';
import { SERVICES } from '@/config/services';

import { OgPreviewBoard } from './OgPreviewBoard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OG Previews | PMBC Admin',
  robots: { index: false, follow: false },
};

export type OgPagePreview = {
  slug: string;
  label: string;
  publicUrl: string;
  ogTitle: string;
  ogSubtitle: string;
  storedOgImageUrl: string | null;
};

const FIRM_PAGE_OG_SUBTITLES: Record<string, string> = {
  home: 'Advisory from Structure to Exit',
  about: 'Senior-led, analytically grounded, commercially focused.',
  services: 'Nine disciplines, one standard of work.',
  sectors: 'Where we deliver depth, not breadth.',
  approach: 'Understand. Analyse. Model. Advise.',
  network: 'Reach extended through partners we trust.',
  about_short: 'About PMBC',
  'financial-modeler-pro': 'The platform built by practitioners.',
  contact: 'Tell us about the mandate.',
};

function stripBrandSuffix(s: string): string {
  return s.replace(/\s*[—|-]\s*PaceMakers Business Consultants\s*$/i, '');
}

export default async function OgPreviewAdminPage() {
  const allPages = await fetchPages();
  const byslug = new Map(allPages.map((p) => [p.slug, p] as const));

  // Hardcoded ordering — matches the public sitemap's logical order rather
  // than the alphabetical cms_pages.slug order.
  const FIRM_ORDER = [
    'home',
    'services',
    'sectors',
    'approach',
    'network',
    'about',
    'financial-modeler-pro',
    'contact',
  ];

  const firmPages: OgPagePreview[] = FIRM_ORDER.map((slug) => {
    const row = byslug.get(slug);
    const titleSource = row?.meta_title ?? row?.title ?? slug;
    const ogTitle = stripBrandSuffix(titleSource);
    const ogSubtitle =
      FIRM_PAGE_OG_SUBTITLES[slug] ?? row?.meta_description ?? '';
    const publicUrl = slug === 'home' ? '/' : `/${slug}`;
    return {
      slug: row?.slug ?? slug,
      label: row?.title ?? slug,
      publicUrl,
      ogTitle,
      ogSubtitle,
      storedOgImageUrl: row?.og_image_url ?? null,
    };
  }).filter((p) => byslug.has(p.slug));

  // Service detail pages (cms_pages.slug pattern: `service-{service-slug}`).
  const servicePages: OgPagePreview[] = SERVICES.map((s) => {
    const slug = `service-${s.slug}`;
    const row = byslug.get(slug);
    return {
      slug,
      label: s.title,
      publicUrl: `/services/${s.slug}`,
      ogTitle: s.title,
      ogSubtitle: s.summary,
      storedOgImageUrl: row?.og_image_url ?? null,
    };
  }).filter((p) => byslug.has(p.slug));

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="OG Image Previews"
          description="Live previews of the auto-generated OG card for every public page. Override the URL per page if you need to ship a custom image instead."
        />
        <OgPreviewBoard firmPages={firmPages} servicePages={servicePages} />
      </div>
    </div>
  );
}
