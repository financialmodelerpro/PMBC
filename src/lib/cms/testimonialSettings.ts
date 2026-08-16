import { fetchSiteSettings } from '@/lib/cms/settings';

/**
 * Whether the testimonial submission form is offered to the public.
 *
 * One switch in Site Settings rather than a visibility toggle on each section,
 * because the question "are we asking clients for testimonials at the moment"
 * is one answer for the whole site, and answering it by remembering every page
 * the form was placed on is how a form gets left on by accident.
 *
 * **Off by default.** The key is absent until somebody turns it on, and an
 * absent key must mean off: a form that appears the moment it is placed would
 * make placing it and publishing it the same act, which is exactly what the
 * switch exists to separate.
 */
export const TESTIMONIAL_FORM_PUBLIC_KEY = 'testimonial_form_public';

export async function isTestimonialFormPublic(): Promise<boolean> {
  try {
    const settings = (await fetchSiteSettings()) as Record<string, unknown>;
    return settings[TESTIMONIAL_FORM_PUBLIC_KEY] === true;
  } catch {
    // A settings read that fails means the form stays off. The safe direction
    // for a switch whose off state is "do not solicit" is off.
    return false;
  }
}
