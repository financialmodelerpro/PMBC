import Image from 'next/image';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type FmpContent = {
  heading: string;
  description_html: string;
  feature_points: string[];
  cta_label: string;
  cta_href: string;
  logo_url: string;
};

function pick(c: Record<string, unknown>): FmpContent {
  const rawPoints =
    (Array.isArray(c.feature_points) && (c.feature_points as unknown[])) ||
    (Array.isArray(c.features) && (c.features as unknown[])) ||
    [];
  const feature_points = rawPoints
    .map((p) => (typeof p === 'string' ? p : null))
    .filter((p): p is string => !!p && p.length > 0);
  return {
    heading: s(c.heading),
    description_html: s(c.description_html) || s(c.description),
    feature_points,
    cta_label: s(c.cta_label) || 'Visit Financial Modeler Pro',
    cta_href: s(c.cta_href) || 'https://www.financialmodelerpro.com',
    logo_url: s(c.logo_url),
  };
}

export function FmpIntro({ content }: { content: Record<string, unknown> }) {
  const c = pick(content ?? {});
  if (!c.heading && !c.description_html && c.feature_points.length === 0) return null;
  const external = /^https?:/i.test(c.cta_href);

  return (
    <section className="bg-[#0F2540] px-6 py-20 text-white lg:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 sm:p-10 lg:p-12">
          {c.logo_url && (
            <div className="relative mb-6 h-10 w-44">
              <Image
                src={c.logo_url}
                alt="Financial Modeler Pro"
                fill
                sizes="176px"
                className="object-contain object-left"
              />
            </div>
          )}
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#D4A93A]">
            Financial Modeler Pro
          </p>
          {c.heading && (
            <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              {c.heading}
            </h2>
          )}
          {c.description_html && (
            <div
              className="prose prose-invert mt-5 max-w-none text-[#E8EEF5]/80"
              dangerouslySetInnerHTML={{ __html: c.description_html }}
            />
          )}
          {c.feature_points.length > 0 && (
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {c.feature_points.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#E8EEF5]">
                  <CheckCircle2
                    size={16}
                    strokeWidth={1.75}
                    className="mt-0.5 flex-shrink-0 text-[#3FA663]"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
          {c.cta_label && c.cta_href && (
            <div className="mt-9">
              <a
                href={c.cta_href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#D4A93A] px-5 py-2.5 text-sm font-semibold text-[#0F2540] transition hover:bg-[#c69a2a]"
              >
                {c.cta_label}
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
