import type { TestimonialRow } from '@/lib/cms/collections';

/**
 * Public testimonials strip. Renders approved client quotes in the boutique
 * editorial style. Returns null when there is nothing approved to show, so it
 * can be dropped onto any page safely.
 */
export function TestimonialsBlock({
  testimonials,
  eyebrow = 'In their words',
  heading = 'What clients say',
}: {
  testimonials: TestimonialRow[];
  eyebrow?: string;
  heading?: string;
}) {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <section className="bg-white px-6 py-20 lg:py-28">
      <div className="mx-auto max-w-[1100px]">
        <div className="mx-auto max-w-2xl text-center">
          <div aria-hidden className="mx-auto h-px w-[60px] bg-[color:var(--pmbc-accent-muted)]" />
          <p
            className="mt-5 text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]"
            style={{ letterSpacing: '0.18em' }}
          >
            {eyebrow}
          </p>
          <h2 className="pmbc-display mt-4 text-[32px] leading-[1.12] sm:text-[40px]">{heading}</h2>
        </div>

        <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <li
              key={t.id}
              className="flex flex-col rounded-[2px] border border-t-2 border-[color:var(--pmbc-border-warm)] bg-[color:var(--pmbc-surface-cream)] p-8"
              style={{ borderTopColor: '#D4A93A' }}
            >
              <span aria-hidden className="font-serif text-5xl leading-none text-[color:var(--pmbc-accent)]">
                &ldquo;
              </span>
              <blockquote className="mt-2 flex-1 font-serif text-[17px] italic leading-[1.7] text-[color:var(--pmbc-text)]">
                {t.text}
              </blockquote>
              <div className="mt-6">
                <p className="text-[14px] font-semibold text-[color:var(--pmbc-text)]">{t.name}</p>
                {(t.role || t.company) && (
                  <p className="mt-0.5 text-[13px] text-[color:var(--pmbc-muted)]">
                    {[t.role, t.company].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
