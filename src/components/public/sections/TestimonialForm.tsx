import { SectionContainer } from '@/components/public/SectionContainer';
import type { PmbcVariant } from '@/lib/public/tokens';
import { sectionCopy } from '@/lib/public/sectionCopy';
import { TestimonialFormFields } from '@/components/public/TestimonialFormFields';

/**
 * The client testimonial form, placeable on any page from the builder.
 *
 * FMP puts its equivalent at a fixed `/testimonials/submit`. PMBC makes it a
 * section instead, so it can sit at the foot of a page a client is already
 * reading rather than on a URL they have to be sent to. The private link case
 * is covered separately, by a token that any page carrying this section
 * accepts.
 *
 * Nothing submitted here reaches a public page. Everything lands as pending in
 * the moderation queue, which is the one promise this section makes to both
 * sides and the reason the note under the button says so.
 */
export function TestimonialForm({
  content,
  styles,
  variant = 'cream',
}: {
  content: Record<string, unknown>;
  styles?: unknown;
  variant?: PmbcVariant;
}) {
  const eyebrow = sectionCopy(content, 'eyebrow', 'In your words');
  const heading = sectionCopy(content, 'heading', 'Share your experience');
  const intro = sectionCopy(
    content,
    'intro',
    'If we have worked together and you would be willing to say so publicly, we would be glad to hear it. Nothing you write appears anywhere until you have approved the wording and we have published it.',
  );
  const buttonLabel = sectionCopy(content, 'button_label', 'Submit testimonial');
  const successMessage = sectionCopy(
    content,
    'success_message',
    'Thank you. Your testimonial has been received and will be reviewed before anything is published.',
  );
  const consentLabel = sectionCopy(
    content,
    'consent_label',
    'I agree that PaceMakers may publish this testimonial, with my name, role and company, on its website and in its materials.',
  );

  return (
    <SectionContainer variant={variant} styles={styles}>
      {(eyebrow || heading || intro) && (
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
          {intro && (
            <p className="mt-5 text-[17px] leading-[1.7] text-[#52606B]">{intro}</p>
          )}
        </div>
      )}

      <div className="mx-auto mt-10 max-w-[720px]">
        <TestimonialFormFields
          buttonLabel={buttonLabel || 'Submit testimonial'}
          successMessage={successMessage}
          consentLabel={consentLabel}
        />
      </div>
    </SectionContainer>
  );
}
