import Link from 'next/link';

import { SectionContainer, SectionIntro } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

type Step = { number: string; title: string; description: string };

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickSteps(c: Record<string, unknown>): {
  eyebrow: string;
  intro: string;
  heading: string;
  steps: Step[];
  footer_cta_label: string;
  footer_cta_href: string;
} {
  const eyebrow = s(c.eyebrow);
  const intro = s(c.intro);
  const heading = s(c.heading) || s(c.headline);
  const footer_cta_label = s(c.footer_cta_label);
  const footer_cta_href = s(c.footer_cta_href);
  const raw = Array.isArray(c.steps) ? (c.steps as unknown[]) : [];
  const steps: Step[] = raw
    .map((row, idx) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const title = s(o.title);
      const description = s(o.description);
      const number = s(o.number) || String(idx + 1).padStart(2, '0');
      if (!title && !description) return null;
      return { number, title, description };
    })
    .filter((step): step is Step => step !== null);
  return { eyebrow, intro, heading, steps, footer_cta_label, footer_cta_href };
}

export function ProcessSteps({
  content,
  variant = 'navy_deep',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const { eyebrow, intro, heading, steps, footer_cta_label, footer_cta_href } = pickSteps(
    content ?? {},
  );
  if (steps.length === 0 && !heading && !intro && !eyebrow) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant}>
      <SectionIntro
        eyebrow={eyebrow}
        headline={heading}
        intro={intro}
        variant={variant}
      />

      {steps.length > 0 && (
        <ol
          className={
            'relative mt-16 grid gap-12 ' +
            (steps.length === 4
              ? 'lg:grid-cols-4 lg:gap-8'
              : steps.length === 3
                ? 'lg:grid-cols-3 lg:gap-10'
                : 'lg:grid-cols-2 lg:gap-10')
          }
        >
          {steps.map((step, i) => (
            <li key={i} className="relative">
              {/* Gold connector to next step on desktop */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-[40px] left-[68px] right-[-32px] hidden h-px lg:block"
                  style={{ background: dark ? 'rgba(212, 169, 58, 0.45)' : 'rgba(184, 149, 48, 0.5)' }}
                />
              )}
              <div className="relative">
                <div
                  className="font-serif text-[56px] font-semibold leading-none sm:text-[64px]"
                  style={{ color: dark ? '#D4A93A' : '#B89530' }}
                >
                  {step.number}
                </div>
                <div
                  aria-hidden
                  className="mt-4 h-px w-[40px]"
                  style={{ background: dark ? 'rgba(212, 169, 58, 0.6)' : 'rgba(184, 149, 48, 0.6)' }}
                />
                {step.title && (
                  <h3
                    className="mt-5 pmbc-display text-[22px] leading-tight sm:text-[24px]"
                    style={{ color: dark ? '#FFFFFF' : v.text }}
                  >
                    {step.title}
                  </h3>
                )}
                {step.description && (
                  <p
                    className="mt-4 text-[15px] leading-[1.7]"
                    style={{ color: dark ? v.textMuted : '#52606B' }}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {footer_cta_label && footer_cta_href && (
        <div className="mt-14 text-center">
          <Link
            href={footer_cta_href}
            className={
              'inline-flex items-center justify-center px-8 py-3.5 text-[12px] font-semibold uppercase transition duration-200 ' +
              (dark
                ? 'border border-[#D4A93A] text-[#E8DDC4] hover:bg-[#D4A93A] hover:text-[#0F2F4F]'
                : 'border border-[#153D64] text-[#153D64] hover:bg-[#153D64] hover:text-white')
            }
            style={{ letterSpacing: '0.12em' }}
          >
            {footer_cta_label}
          </Link>
        </div>
      )}
    </SectionContainer>
  );
}
