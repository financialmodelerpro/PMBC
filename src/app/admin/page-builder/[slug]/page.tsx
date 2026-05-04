import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { sectionFromRow } from '@/lib/cms/serializers';
import { ADMIN_COLORS } from '@/lib/admin/styles';

import { PageBuilder } from './PageBuilder';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export async function generateMetadata(props: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  return {
    title: `${slug} | Page Builder`,
    robots: { index: false, follow: false },
  };
}

export default async function PageBuilderPage(props: { params: Promise<Params> }) {
  const { slug } = await props.params;

  const page = await fetchPage(slug);
  if (!page) notFound();

  const sections = await fetchPageSections(slug);
  const initial = sections.map(sectionFromRow);

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
      <PageBuilder
        pageSlug={page.slug}
        pageTitle={page.title}
        pageStatus={page.status}
        initialSections={initial}
      />
    </div>
  );
}
