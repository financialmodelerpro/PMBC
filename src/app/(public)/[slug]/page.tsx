import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionRenderer } from '@/components/public/SectionRenderer';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export async function generateMetadata(props: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await fetchPage(slug);
  if (!page) return { title: 'PaceMakers Business Consultants' };
  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
  };
}

export default async function PublicSlugPage(props: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const page = await fetchPage(slug);
  if (!page) notFound();

  // Hide draft pages from the public, but allow ?preview=1 to render them for the page builder iframe.
  if (page.status !== 'published' && !isPreview) {
    notFound();
  }

  const sections = await fetchPageSections(slug, { onlyVisible: !isPreview });

  return (
    <main>
      {sections.length === 0 ? (
        <div className="px-6 py-32 text-center">
          <p className="text-[11px] tracking-[0.2em] uppercase text-neutral-500">
            {page.title}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F1B2D]">
            No sections yet
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Add sections via the page builder.
          </p>
        </div>
      ) : (
        sections.map((s) => <SectionRenderer key={s.id} section={s} />)
      )}
    </main>
  );
}
