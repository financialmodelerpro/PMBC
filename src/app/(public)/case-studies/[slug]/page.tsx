import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { fetchCaseStudyBySlug } from '@/lib/cms/collections';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

type Params = { slug: string };
type Metric = { label: string; value: string };

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await props.params;
  const study = await fetchCaseStudyBySlug(slug);
  if (!study) return { title: 'Case Study' };
  return buildPageMetadata({
    path: `/case-studies/${slug}`,
    cmsPage: null,
    fallback: {
      title: `${study.seo_title || study.title} | PaceMakers Business Consultants`,
      description: study.seo_description || study.summary || 'A PaceMakers engagement.',
      ogSubtitle: study.industry || 'Case study',
    },
  });
}

function readMetrics(value: unknown): Metric[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (m): m is Metric =>
      !!m && typeof m === 'object' && 'label' in m && 'value' in m,
  );
}

export default async function CaseStudyDetailPage(props: { params: Promise<Params> }) {
  const { slug } = await props.params;
  const study = await fetchCaseStudyBySlug(slug);
  if (!study) notFound();

  const metrics = readMetrics(study.metrics);

  return (
    <main>
      <section
        className="px-6 pt-28 pb-16 text-white sm:pt-32"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, #173E63 0%, #102E4C 55%, #0C2741 100%)',
        }}
      >
        <div className="mx-auto max-w-[820px]">
          <Link
            href="/case-studies"
            className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase"
            style={{ letterSpacing: '0.12em', color: '#E8DDC4' }}
          >
            <ArrowLeft size={14} /> All case studies
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {study.industry && (
              <span
                className="text-[11px] font-semibold uppercase"
                style={{ letterSpacing: '0.14em', color: '#D4A93A' }}
              >
                {study.industry}
              </span>
            )}
            {study.client_name && (
              <span className="text-[13px]" style={{ color: '#E8DDC4' }}>
                {study.client_name}
              </span>
            )}
          </div>
          <h1 className="pmbc-display mt-4 text-[36px] leading-[1.12] sm:text-[48px]">
            {study.title}
          </h1>
          {study.summary && (
            <p className="mt-5 max-w-[640px] text-[17px] leading-[1.7]" style={{ color: '#E8DDC4' }}>
              {study.summary}
            </p>
          )}
        </div>
      </section>

      {metrics.length > 0 && (
        <section className="border-b border-[color:var(--pmbc-border-warm)] bg-white px-6 py-12">
          <div className="mx-auto grid max-w-[820px] gap-8 sm:grid-cols-3">
            {metrics.map((m, i) => (
              <div key={i} className="text-center sm:text-left">
                <p className="font-serif text-[34px] font-semibold text-[color:var(--pmbc-primary)]">
                  {m.value}
                </p>
                <p className="mt-1 text-[13px] uppercase text-[color:var(--pmbc-muted)]" style={{ letterSpacing: '0.08em' }}>
                  {m.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-[760px]">
          {study.cover_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={study.cover_image} alt="" className="mb-10 w-full rounded-[2px] object-cover" />
          )}
          {study.body ? (
            <div
              className="pmbc-prose text-[17px] leading-[1.8] text-[color:var(--pmbc-text)]"
              dangerouslySetInnerHTML={{ __html: study.body }}
            />
          ) : (
            <p className="text-[16px] text-[color:var(--pmbc-muted)]">Full write-up coming soon.</p>
          )}
        </div>
      </section>
    </main>
  );
}
