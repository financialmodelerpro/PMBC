import { SectionContainer } from '@/components/public/SectionContainer';
import type { PmbcVariant } from '@/lib/public/tokens';
import type { SectionContext } from '@/lib/public/sectionContext';
import { sectionCopy } from '@/lib/public/sectionCopy';

/**
 * Approved client quotes, as a section an operator can add to any page.
 *
 * The component existed from Phase 10 and rendered nowhere: the moderation
 * queue, the table and the API were all built, but the public half was never
 * registered as a section type, so there was no way to put it on a page. This
 * is that missing wiring rather than a new feature.
 *
 * **The quotes are not section content.** They come from the `testimonials`
 * table through the context, so the moderation queue at `/admin/testimonials`
 * stays the one place a quote is approved, ordered or withdrawn. What this
 * section owns is the eyebrow and heading above them, and whether to show every
 * approved quote or only those flagged for the homepage.
 *
 * Renders nothing at all when no quote qualifies. An empty band with a heading
 * over it would advertise that the firm has no testimonials, which is worse
 * than the section simply not being there.
 */
export function Testimonials({
  content,
  styles,
  variant = 'white',
  context = {},
}: {
  content: Record<string, unknown>;
  styles?: unknown;
  variant?: PmbcVariant;
  context?: SectionContext;
}) {
  const all = context.testimonials ?? [];
  const onlyLanding = content.only_landing === true;
  const testimonials = onlyLanding ? all.filter((t) => t.show_on_landing) : all;

  if (testimonials.length === 0) return null;

  const eyebrow = sectionCopy(content, 'eyebrow', 'In their words');
  const heading = sectionCopy(content, 'heading', 'What clients say');

  return (
    <SectionContainer variant={variant} styles={styles}>
      {(eyebrow || heading) && (
        <div className="mx-auto max-w-2xl text-center">
          <div
            aria-hidden
            className="mx-auto h-px w-[60px] bg-[color:var(--pmbc-accent-muted)]"
          />
          {eyebrow && (
            <p
              className="mt-5 text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]"
              style={{ letterSpacing: '0.18em' }}
            >
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="pmbc-display mt-4 text-[32px] leading-[1.12] sm:text-[40px]">
              {heading}
            </h2>
          )}
        </div>
      )}

      <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <li
            key={t.id}
            className="flex flex-col rounded-[2px] border border-t-2 border-[color:var(--pmbc-border-warm)] bg-[color:var(--pmbc-surface-cream)] p-8"
            style={{ borderTopColor: '#C69C3E' }}
          >
            <span
              aria-hidden
              className="font-serif text-5xl leading-none text-[color:var(--pmbc-accent)]"
            >
              &ldquo;
            </span>
            <blockquote className="mt-2 flex-1 font-serif text-[17px] italic leading-[1.7] text-[color:var(--pmbc-text)]">
              {t.text}
            </blockquote>
            <div className="mt-6">
              <p className="text-[14px] font-semibold text-[color:var(--pmbc-text)]">
                {t.name}
              </p>
              {(t.role || t.company) && (
                <p className="mt-0.5 text-[13px] text-[color:var(--pmbc-muted)]">
                  {[t.role, t.company].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SectionContainer>
  );
}
