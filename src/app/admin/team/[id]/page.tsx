import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { sectionFromRow } from '@/lib/cms/serializers';
import { memberProfileSlug } from '@/lib/cms/teamProfiles';
import { FOUNDER_PAGE_SLUG } from '@/lib/cms/founderProfile';
import { ADMIN_COLORS } from '@/lib/admin/styles';

import { MemberScreen } from './MemberScreen';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Team member | Admin',
  robots: { index: false, follow: false },
};

/**
 * One screen per member: their details (shared by the /team card and their
 * profile header) and, below, their profile page's sections in the same
 * builder the other pages use. The admin layout has already checked the
 * session; every write goes through an API route that checks it again.
 */
export default async function TeamMemberPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: member } = await createSupabaseServerClient()
    .from('team_members')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!member) notFound();

  const slug = memberProfileSlug(member);
  const page = slug ? await fetchPage(slug) : null;
  const sections = page ? (await fetchPageSections(page.slug)).map(sectionFromRow) : [];

  return (
    <div
      style={{
        flex: 1,
        background: ADMIN_COLORS.pageBg,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <MemberScreen
        member={member as unknown as Record<string, unknown> & { id: string }}
        // Before migration 109 the column is absent and no profile can be linked.
        canLinkProfile={'profile_slug' in member}
        isFounder={slug === FOUNDER_PAGE_SLUG}
        page={
          page
            ? {
                slug: page.slug,
                title: page.title,
                status: page.status,
                metaTitle: page.meta_title ?? '',
                metaDescription: page.meta_description ?? '',
              }
            : null
        }
        sections={sections}
      />
    </div>
  );
}
