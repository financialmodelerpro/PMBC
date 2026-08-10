import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export type SiteSettings = {
  /** General enquiries. Also what the footer and /book show. */
  contact_email?: string;
  /**
   * The two additional public addresses shown on /contact. Kept as discrete
   * keys per the namespace convention in CLAUDE.md section 4, and separate from
   * `admin_email`, which is where notifications are delivered rather than an
   * address published to visitors.
   */
  contact_email_advisory?: string;
  contact_email_founder?: string;
  contact_label_general?: string;
  contact_label_advisory?: string;
  contact_label_founder?: string;
  admin_email?: string;
  whatsapp_number?: string;
  phone_number?: string;
  office_location_text?: string;
  /**
   * Full Calendly event URL rendered by the inline widget on /book. Site-wide
   * rather than section-scoped, so one edit repoints every booking surface.
   * Empty is supported: /book then leads with the direct contact routes.
   */
  booking_url?: string;
  social_linkedin?: string;
  social_twitter?: string;
  default_og_image_url?: string;
  google_analytics_id?: string;
};

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  const blob = (data?.settings ?? {}) as Json;
  if (blob && typeof blob === 'object' && !Array.isArray(blob)) {
    return blob as SiteSettings;
  }
  return {};
}
