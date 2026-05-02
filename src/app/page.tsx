import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { SectionRenderer } from '@/components/public/SectionRenderer';

export const dynamic = 'force-dynamic';

export default async function Home(props: {
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
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-xs font-medium tracking-[0.18em] uppercase text-neutral-500">
          PaceMakers Business Consultants
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          PMBC v1 — home page sections not configured
        </h1>
        <p className="mt-4 max-w-md text-sm text-neutral-600">
          Add sections to slug{' '}
          <code className="font-mono">home</code> via{' '}
          <a className="underline" href="/admin/page-builder/home">
            /admin/page-builder/home
          </a>
          .
        </p>
      </main>
    );
  }

  return (
    <main>
      {sections.map((s) => (
        <SectionRenderer key={s.id} section={s} />
      ))}
    </main>
  );
}
