import Link from 'next/link';
import type { Metadata } from 'next';

import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionRenderer } from '@/components/public/SectionRenderer';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPage('home');
  return buildPageMetadata({
    path: '/',
    cmsPage: page,
    fallback: {
      title: 'PaceMakers Business Consultants — Advisory from Structure to Exit',
      description:
        'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.',
      ogSubtitle: 'Advisory from Structure to Exit',
    },
  });
}

export default async function HomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const page = await fetchPage('home');
  const sections = page
    ? await fetchPageSections('home', { onlyVisible: !isPreview })
    : [];

  if (sections.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-3 text-[11px] font-medium tracking-[0.22em] uppercase text-[color:var(--pmbc-primary)]">
          PaceMakers Business Consultants
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-4xl">
          Home page sections not configured
        </h1>
        <p className="mt-4 max-w-md text-sm text-[color:var(--pmbc-muted)]">
          Add sections to slug <code className="font-mono">home</code> via{' '}
          <Link className="underline" href="/admin/page-builder/home">
            /admin/page-builder/home
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      {sections.map((s) => (
        <SectionRenderer key={s.id} section={s} />
      ))}
    </>
  );
}
