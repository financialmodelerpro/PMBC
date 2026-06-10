import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { fetchArticleBySlug } from '@/lib/cms/collections';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await fetchArticleBySlug(slug);
  if (!article) return { title: 'Insight' };
  return buildPageMetadata({
    path: `/insights/${slug}`,
    cmsPage: null,
    fallback: {
      title: `${article.seo_title || article.title} | PaceMakers Business Consultants`,
      description: article.seo_description || article.excerpt || 'An insight from PaceMakers.',
      ogSubtitle: article.category || 'Insight',
    },
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function InsightDetailPage(props: { params: Promise<Params> }) {
  const { slug } = await props.params;
  const article = await fetchArticleBySlug(slug);
  if (!article) notFound();

  return (
    <main>
      <section
        className="px-6 pt-28 pb-14 text-white sm:pt-32"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, #173E63 0%, #102E4C 55%, #0C2741 100%)',
        }}
      >
        <div className="mx-auto max-w-[760px]">
          <Link
            href="/insights"
            className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase"
            style={{ letterSpacing: '0.12em', color: '#E8DDC4' }}
          >
            <ArrowLeft size={14} /> All insights
          </Link>
          {article.category && (
            <p
              className="mt-8 text-[11px] font-semibold uppercase"
              style={{ letterSpacing: '0.14em', color: '#D4A93A' }}
            >
              {article.category}
            </p>
          )}
          <h1 className="pmbc-display mt-3 text-[34px] leading-[1.14] sm:text-[46px]">
            {article.title}
          </h1>
          <p className="mt-5 text-[13px] uppercase" style={{ letterSpacing: '0.08em', color: '#E8DDC4' }}>
            {fmtDate(article.published_at)}
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-[720px]">
          {article.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.cover_url} alt="" className="mb-10 w-full rounded-[2px] object-cover" />
          )}
          {article.body ? (
            <div
              className="pmbc-prose text-[17px] leading-[1.85] text-[color:var(--pmbc-text)]"
              dangerouslySetInnerHTML={{ __html: article.body }}
            />
          ) : (
            <p className="text-[16px] text-[color:var(--pmbc-muted)]">{article.excerpt}</p>
          )}
        </div>
      </section>
    </main>
  );
}
