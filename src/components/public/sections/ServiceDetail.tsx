import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';

import { SERVICES } from '@/config/services';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type ServiceDetailContent = {
  service_slug: string;
  full_description_html: string;
  deliverables: string[];
  timeline_text: string;
  target_audience_text: string;
};

function pick(c: Record<string, unknown>): ServiceDetailContent {
  const rawDeliverables =
    (Array.isArray(c.deliverables) && (c.deliverables as unknown[])) || [];
  const deliverables = rawDeliverables
    .map((p) => (typeof p === 'string' ? p : null))
    .filter((p): p is string => !!p && p.length > 0);
  return {
    service_slug: s(c.service_slug),
    full_description_html: s(c.full_description_html) || s(c.description),
    deliverables,
    timeline_text: s(c.timeline_text),
    target_audience_text: s(c.target_audience_text),
  };
}

export function ServiceDetail({ content }: { content: Record<string, unknown> }) {
  const c = pick(content ?? {});
  const service = SERVICES.find((sv) => sv.slug === c.service_slug);
  const number = service?.number ?? '';
  const title = service?.title ?? '';
  const summary = service?.summary ?? '';

  if (!service && !c.full_description_html && c.deliverables.length === 0) return null;

  const related = service
    ? SERVICES.filter((sv) => sv.slug !== service.slug).slice(0, 3)
    : [];

  return (
    <section className="px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-5xl">
        {number && (
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#1B3A5F]">
            Service · {number}
          </p>
        )}
        {title && (
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-[#0F1B2D] sm:text-5xl">
            {title}
          </h1>
        )}
        {summary && (
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            {summary}
          </p>
        )}

        {c.full_description_html && (
          <div
            className="prose prose-neutral mt-10 max-w-3xl text-[#0F1B2D]"
            dangerouslySetInnerHTML={{ __html: c.full_description_html }}
          />
        )}

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {c.deliverables.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white p-6 lg:col-span-2">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#1B3A5F]">
                Key deliverables
              </p>
              <ul className="mt-4 space-y-2.5">
                {c.deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#0F1B2D]">
                    <CheckCircle2
                      size={16}
                      strokeWidth={1.75}
                      className="mt-0.5 flex-shrink-0 text-[#3FA663]"
                    />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(c.timeline_text || c.target_audience_text) && (
            <div className="space-y-6">
              {c.timeline_text && (
                <div className="rounded-lg border border-neutral-200 bg-white p-6">
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#1B3A5F]">
                    Typical timeline
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#0F1B2D]">
                    {c.timeline_text}
                  </p>
                </div>
              )}
              {c.target_audience_text && (
                <div className="rounded-lg border border-neutral-200 bg-white p-6">
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#1B3A5F]">
                    Who it&apos;s for
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#0F1B2D]">
                    {c.target_audience_text}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {related.length > 0 && (
          <div className="mt-16 border-t border-neutral-200 pt-10">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#1B3A5F]">
              Related services
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/services/${r.slug}`}
                  className="group rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-[#1B3A5F] hover:shadow-[0_2px_10px_rgba(15,27,45,0.06)]"
                >
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#1B3A5F]">
                    {r.number}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[#0F1B2D]">
                    {r.title}
                    <ArrowRight
                      size={13}
                      className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-[#1B3A5F]"
                    />
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
