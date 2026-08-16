import { SectionContainer } from '@/components/public/SectionContainer';
import type { PmbcVariant } from '@/lib/public/tokens';
import type { SectionContext } from '@/lib/public/sectionContext';
import { sectionCopy } from '@/lib/public/sectionCopy';
import { normaliseExternalUrl } from '@/lib/public/externalUrl';

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
  const filtered = onlyLanding ? all.filter((t) => t.show_on_landing) : all;

  /**
   * Optional cap. Absent means every approved quote, which is what this section
   * did before the key existed, so no existing placement changes. Set to one or
   * two where the block is a proof point inside a longer page rather than the
   * page's own subject, which is the difference between home and a dedicated
   * testimonials page.
   *
   * Ordering is the queue's, by `display_order`, so a cap of two takes the two
   * an operator put at the top rather than two at random.
   */
  const rawMax = content.max_items;
  const max =
    typeof rawMax === 'number' && Number.isFinite(rawMax) && rawMax > 0
      ? Math.floor(rawMax)
      : typeof rawMax === 'string' && rawMax.trim() !== '' && Number(rawMax) > 0
        ? Math.floor(Number(rawMax))
        : null;
  const testimonials = max === null ? filtered : filtered.slice(0, max);

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
        {testimonials.map((t) => {
          // Read loosely: migration 072 is DDL and hand-run, so a database
          // without it has neither column and both must simply be absent rather
          // than throwing. Normalised at render as well as on submit, so a row
          // stored before the normaliser existed still links off-site instead
          // of resolving against pacemakersglobal.com.
          const extra = t as unknown as { photo_url?: string | null; linkedin_url?: string | null };
          const photo = (extra.photo_url ?? '').trim();
          const linkedin = normaliseExternalUrl(extra.linkedin_url);
          const attribution = [t.role, t.company].filter(Boolean).join(', ');
          return (
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
            <div className="mt-6 flex items-center gap-3">
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                  style={{ border: '1px solid var(--pmbc-border-warm)' }}
                />
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[color:var(--pmbc-text)]">
                  {linkedin ? (
                    <a
                      href={linkedin}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline decoration-[color:var(--pmbc-accent)] underline-offset-4 hover:text-[color:var(--pmbc-primary)]"
                    >
                      {t.name}
                    </a>
                  ) : (
                    t.name
                  )}
                </p>
                {attribution && (
                  <p className="mt-0.5 text-[13px] text-[color:var(--pmbc-muted)]">
                    {attribution}
                  </p>
                )}
              </div>
            </div>
          </li>
          );
        })}
      </ul>
    </SectionContainer>
  );
}
