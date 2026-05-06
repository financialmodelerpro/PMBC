import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';

import { SERVICES } from '@/config/services';
import { SectionContainer } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

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

export function ServiceDetail({
  content,
  variant = 'white',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  const service = SERVICES.find((sv) => sv.slug === c.service_slug);
  const number = service?.number ?? '';
  const title = service?.title ?? '';
  const summary = service?.summary ?? '';

  if (!service && !c.full_description_html && c.deliverables.length === 0) return null;

  const related = service
    ? SERVICES.filter((sv) => sv.slug !== service.slug).slice(0, 3)
    : [];

  const v = variantStyles(variant);

  return (
    <SectionContainer variant={variant}>
      <div className="mx-auto max-w-[1000px]">
        <div
          aria-hidden
          className="h-px w-[60px]"
          style={{ background: '#B89530' }}
        />
        {number && (
          <p
            className="mt-5 text-[11px] font-semibold uppercase"
            style={{ letterSpacing: '0.18em', color: '#B89530' }}
          >
            Service · {number}
          </p>
        )}
        {title && (
          <h1
            className="pmbc-display mt-5 text-[40px] leading-[1.1] sm:text-[52px] lg:text-[60px]"
            style={{ color: v.text }}
          >
            {title}
          </h1>
        )}
        {summary && (
          <p
            className="mt-6 max-w-[780px] text-[18px] leading-[1.7] sm:text-[20px]"
            style={{ color: '#52606B' }}
          >
            {summary}
          </p>
        )}

        {c.full_description_html && (
          <div
            className="prose prose-neutral mt-12 max-w-[780px]"
            style={{ color: v.text, fontSize: 17, lineHeight: 1.75 }}
            dangerouslySetInnerHTML={{ __html: c.full_description_html }}
          />
        )}

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {c.deliverables.length > 0 && (
            <div
              className="relative p-8 lg:col-span-2"
              style={{
                background: v.cardBg,
                border: `1px solid ${v.cardBorder}`,
              }}
            >
              <span
                aria-hidden
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: '#D4A93A' }}
              />
              <p
                className="text-[11px] font-semibold uppercase"
                style={{ letterSpacing: '0.18em', color: '#B89530' }}
              >
                Key deliverables
              </p>
              <ul className="mt-5 space-y-3">
                {c.deliverables.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-[15px] leading-[1.6]"
                    style={{ color: v.text }}
                  >
                    <CheckCircle2
                      size={16}
                      strokeWidth={2}
                      className="mt-1 flex-shrink-0"
                      style={{ color: '#3FA663' }}
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
                <div
                  className="relative p-8"
                  style={{
                    background: v.cardBg,
                    border: `1px solid ${v.cardBorder}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: '#D4A93A' }}
                  />
                  <p
                    className="text-[11px] font-semibold uppercase"
                    style={{ letterSpacing: '0.18em', color: '#B89530' }}
                  >
                    Typical timeline
                  </p>
                  <p
                    className="mt-3 text-[15px] leading-[1.7]"
                    style={{ color: v.text }}
                  >
                    {c.timeline_text}
                  </p>
                </div>
              )}
              {c.target_audience_text && (
                <div
                  className="relative p-8"
                  style={{
                    background: v.cardBg,
                    border: `1px solid ${v.cardBorder}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: '#D4A93A' }}
                  />
                  <p
                    className="text-[11px] font-semibold uppercase"
                    style={{ letterSpacing: '0.18em', color: '#B89530' }}
                  >
                    Who it&apos;s for
                  </p>
                  <p
                    className="mt-3 text-[15px] leading-[1.7]"
                    style={{ color: v.text }}
                  >
                    {c.target_audience_text}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {related.length > 0 && (
          <div
            className="mt-20 pt-12"
            style={{ borderTop: `1px solid ${v.border}` }}
          >
            <div
              aria-hidden
              className="h-px w-[40px]"
              style={{ background: '#B89530' }}
            />
            <p
              className="mt-4 text-[11px] font-semibold uppercase"
              style={{ letterSpacing: '0.18em', color: '#B89530' }}
            >
              Related services
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/services/${r.slug}`}
                  className="group relative overflow-hidden p-7 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(15,37,64,0.08)]"
                  style={{
                    background: v.cardBg,
                    border: `1px solid ${v.cardBorder}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: '#D4A93A' }}
                  />
                  <p className="font-serif text-[20px] font-semibold text-[#B89530]">
                    {r.number}
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 font-serif text-[16px] font-semibold text-[#0F1B2D]">
                    {r.title}
                    <ArrowRight
                      size={14}
                      className="text-[#B89530] transition group-hover:translate-x-0.5"
                    />
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionContainer>
  );
}
