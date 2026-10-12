import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionList } from '@/components/public/SectionRenderer';
import { heroContacts } from '@/components/public/sections/FounderHero';
import { buildPageMetadata, siteUrl } from '@/lib/seo/metadata';
import {
  PROFILE_SLUG_PREFIX,
  fetchMemberForProfile,
  withMemberHero,
} from '@/lib/cms/teamProfiles';
import type { Tables } from '@/types/database';

export const dynamic = 'force-dynamic';

type Params = { member: string };

/** `/team/kaleem-farooq` is the CMS page `about-kaleem-farooq`. Anything else is not a profile. */
function profileSlugFor(member: string): string | null {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(member) ? `${PROFILE_SLUG_PREFIX}${member}` : null;
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const { member } = await props.params;
  const slug = profileSlugFor(member);
  if (!slug) return {};
  const [page, person] = await Promise.all([fetchPage(slug), fetchMemberForProfile(slug)]);
  const name = person?.name ?? page?.title ?? 'Team';
  const role = person?.role ?? '';
  return buildPageMetadata({
    path: `/team/${member}`,
    cmsPage: page,
    fallback: {
      title: `${name}${role ? ` | ${role}` : ''} | PaceMakers`,
      description: `${name}${role ? `, ${role},` : ''} at PaceMakers Business Consultants.`,
      ogSubtitle: role || 'PaceMakers Business Consultants',
    },
  });
}

/**
 * Person schema built from the member record and the page's own content: the
 * name, role and location from Team & Advisors, `knowsAbout` from the first
 * list shown as pills (the expertise list on every profile), and the contact
 * row from the hero, validated the way the hero validates it. `<` is escaped so
 * nothing can close the script tag. Linked to the Organization node the public
 * layout mounts.
 */
function personJsonLd(
  path: string,
  person: Tables<'team_members'> | null,
  sections: Tables<'page_sections'>[],
  contacts: ReturnType<typeof heroContacts>,
  heroName: string,
) {
  const base = siteUrl();
  const [name, suffix] = (person?.name ?? heroName).split(',').map((s) => s.trim());
  const pills = sections.find(
    (s) =>
      s.section_type === 'founder_credentials' &&
      s.visible &&
      (s.content as Record<string, unknown> | null)?.display === 'pills',
  );
  const knowsAbout = Array.isArray((pills?.content as Record<string, unknown> | null)?.items)
    ? ((pills!.content as Record<string, unknown>).items as unknown[])
        .filter((i): i is string => typeof i === 'string' && i.trim() !== '')
        .map((i) => i.trim())
    : [];
  const location = person?.location?.trim();
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${base}${path}#person`,
    name,
    ...(suffix ? { honorificSuffix: suffix } : {}),
    ...(person?.role ? { jobTitle: person.role } : {}),
    url: `${base}${path}`,
    worksFor: { '@id': `${base}#organization` },
    ...(location ? { workLocation: { '@type': 'Place', name: location } } : {}),
    ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
    ...(contacts.email ? { email: `mailto:${contacts.email}` } : {}),
    ...(contacts.dial ? { telephone: contacts.dial } : {}),
    ...(contacts.linkedin ? { sameAs: [contacts.linkedin] } : {}),
  };
}

/**
 * Every team profile except the founding partner's, which keeps its own route
 * (`/team/ahmad-din`, a static segment, so it wins over this one) for its
 * richer Person schema.
 *
 * The sections are the member's profile page, edited in Team & Advisors; the
 * header's name, photo and credentials line come from the member record. The
 * page 404s until it has sections rather than serving an empty shell.
 */
export default async function TeamProfilePage(props: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ member }, search] = await Promise.all([props.params, props.searchParams]);
  const slug = profileSlugFor(member);
  if (!slug) notFound();
  const isPreview = search.preview === '1';

  const [rawSections, person] = await Promise.all([
    fetchPageSections(slug, { onlyVisible: !isPreview }),
    fetchMemberForProfile(slug),
  ]);
  if (rawSections.length === 0) notFound();
  // A member who is unpublished in Team & Advisors has no public profile either.
  if (person && !person.visible && !isPreview) notFound();

  const sections = withMemberHero(rawSections, person);
  const hero = sections.find((s) => s.section_type === 'founder_hero' && s.visible);
  const heroContent = (hero?.content ?? {}) as Record<string, unknown>;
  const contacts = heroContacts(heroContent);
  const heroName = typeof heroContent.name === 'string' ? heroContent.name : '';
  const jsonLd = JSON.stringify(
    personJsonLd(`/team/${member}`, person, sections, contacts, heroName),
  ).replace(/</g, '\\u003c');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SectionList sections={sections} />
    </>
  );
}
