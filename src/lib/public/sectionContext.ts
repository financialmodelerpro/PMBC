import type { SiteSettings } from '@/lib/cms/settings';

/**
 * Per-request data a section renderer cannot fetch from its own content blob.
 *
 * Most section types are pure: everything they render is in `page_sections.
 * content`, which is why the renderer signature never needed anything else.
 * Two are not. The contact body embeds a live form and the firm's published
 * addresses; the booking body embeds a calendar whose URL is a site-wide
 * setting. Neither of those is page copy, so neither belongs in the section
 * row, and the query string behind the service pre-fill cannot be in a
 * database at all.
 *
 * The route fetches these, the way routes in this codebase already do, and
 * passes them down. Renderers stay synchronous, and a renderer that does not
 * need the context simply ignores the prop.
 *
 * Every field is optional on purpose: a section rendered outside its own page,
 * or previewed in the builder, gets an empty context and degrades to the same
 * empty states it would show if the underlying setting were blank.
 */
export type SectionContext = {
  /** Published contact routes: the three addresses, WhatsApp, office. */
  settings?: SiteSettings;
  /** Founder portrait, read from the `founder_hero` section on the profile page. */
  founderPhotoUrl?: string | null;
  /** hCaptcha site key for the embedded contact form. Null disables the widget. */
  hcaptchaSiteKey?: string | null;
  /** Service pre-selected from `?service=<slug>` on /contact. */
  defaultServiceTitle?: string;
  /** Calendly event URL, from `site_settings.booking_url`. Empty is a supported state. */
  bookingUrl?: string;
  /**
   * The nine service cards for the `/services` grid: the managed `services`
   * collection when it has rows, the static config otherwise.
   *
   * Not section content, and deliberately so. The same nine drive the related
   * services cards, the contact form's dropdown, the sitemap and the JSON-LD,
   * so a second copy inside one section row would be a second place to edit
   * them and a second place for them to go stale.
   */
  services?: ServiceCard[];
};

export type ServiceCard = {
  slug: string;
  number: string;
  title: string;
  summary: string;
};
