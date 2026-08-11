import { SectionContainer, SectionIntro } from '../SectionContainer';
import { sanitizeRichHtml } from '@/lib/cms/sanitize';
import { visibleListItems } from '@/lib/public/itemVisibility';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';

/**
 * Long-form prose beside a gold-ticked checklist.
 *
 * Added for the Financial Modeler Pro page, which needed an explanation on the
 * left and a scannable list of what the platform is on the right. Neither
 * `paragraphs` (one column) nor `text_image` (needs an image, and draws an
 * empty gold box without one) could express that, and stacking the two would
 * have lost the point of the pairing: the list is a summary of the prose, read
 * alongside it rather than after it.
 *
 * 55/45 from lg up, matching the shared section media split, so the two
 * side-by-side layouts on the site break at the same width and in the same
 * proportion. Below that it stacks with the prose first, because the prose is
 * the argument and the list is the summary.
 */

type ChecklistItem = { title: string; description: string };

function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function pickItems(raw: unknown): ChecklistItem[] {
  return visibleListItems(raw)
    .map((row) => {
      if (typeof row === 'string') return { title: row.trim(), description: '' };
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const title = s(o.title) || s(o.label);
      if (!title) return null;
      return { title, description: s(o.description) || s(o.desc) };
    })
    .filter((i): i is ChecklistItem => !!i);
}

export function ProseChecklist({
  content,
  styles,
  variant = 'white',
  media = null,
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
  media?: SectionMediaValue | null;
}) {
  const c = content ?? {};
  const eyebrow = s(c.eyebrow);
  const heading = s(c.heading) || s(c.headline);
  const html = typeof c.html === 'string' ? c.html : '';
  const listHeading = s(c.list_heading);
  const items = pickItems(c.items);

  if (!html && items.length === 0 && !heading) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant} styles={styles} media={media}>
      <SectionIntro eyebrow={eyebrow} headline={heading} variant={variant} align="left" />

      <div className="mt-12 grid items-start gap-12 lg:grid-cols-[55fr_45fr] lg:gap-16">
        <div>
          {html && (
            <div
              className={['pmbc-prose', dark ? 'pmbc-prose-invert' : ''].filter(Boolean).join(' ')}
              style={{ color: dark ? '#E8DDC4' : v.text, fontSize: 17, lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
            />
          )}
        </div>

        {items.length > 0 && (
          <div
            style={{
              background: v.cardBg,
              border: `1px solid ${v.cardBorder}`,
              borderRadius: 8,
              padding: '32px 28px',
            }}
          >
            {listHeading && (
              <p
                className="mb-6 text-[11px] font-semibold uppercase"
                style={{ letterSpacing: '0.18em', color: v.eyebrow }}
              >
                {listHeading}
              </p>
            )}
            <ul className="flex flex-col gap-5">
              {items.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-[3px] shrink-0 text-[13px]"
                    style={{ color: dark ? '#C69C3E' : '#A88530' }}
                  >
                    &#10003;
                  </span>
                  <span>
                    <span
                      className="block text-[15px] font-semibold leading-[1.45]"
                      style={{ color: v.text }}
                    >
                      {item.title}
                    </span>
                    {item.description && (
                      <span
                        className="mt-1 block text-[14px] leading-[1.6]"
                        style={{ color: v.textMuted }}
                      >
                        {item.description}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionContainer>
  );
}
