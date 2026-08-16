import type { Metadata } from 'next';

import { fetchPage, fetchPageSections, fetchFounderPhotoUrl } from '@/lib/cms/pages';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { SectionList } from '@/components/public/SectionRenderer';
import { ContactBody } from '@/components/public/sections/ContactBody';
import { SERVICES } from '@/config/services';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { SectionContext } from '@/lib/public/sectionContext';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('contact');
  return buildPageMetadata({
    path: '/contact',
    cmsPage: page,
    fallback: {
      title: 'Contact | PaceMakers Business Consultants',
      description: 'Start a conversation about your mandate.',
      ogSubtitle: 'Tell us about the mandate.',
    },
  });
}

export default async function ContactPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  // /services/[slug] CTAs link here as `?service=<slug>`, so pre-fill the
  // service-interest dropdown with the matching service title when present.
  const rawService = search.service;
  const serviceSlug = typeof rawService === 'string' ? rawService : '';
  const defaultServiceTitle =
    SERVICES.find((s) => s.slug === serviceSlug)?.title ?? undefined;

  const [sections, settings, founderPhotoUrl] = await Promise.all([
    fetchPageSections('contact', { onlyVisible: !isPreview }),
    safe(fetchSiteSettings(), {}),
    // Read from the founder_hero section rather than hardcoded: uploading a
    // new portrait in the page builder updates the founder card too.
    safe(fetchFounderPhotoUrl(), null),
  ]);

  // Everything this page says is now section content, edited in the page
  // builder like every other page (migration 066). What is left here is the
  // per-request data no section row can hold.
  const context: SectionContext = {
    settings,
    founderPhotoUrl,
    hcaptchaSiteKey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || null,
    defaultServiceTitle,
  };

  // A database that has not run migration 066 has no `contact_body` row, and a
  // contact page with no form is worse than one with a section out of order.
  // Same reasoning as `FirmPageBody`'s fallback hero.
  const hasBody = sections.some((s) => s.section_type === 'contact_body');

  return (
    <>
      <SectionList sections={sections} context={context} />
      {!hasBody && <ContactBody content={{}} variant="cream" context={context} />}
    </>
  );
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
