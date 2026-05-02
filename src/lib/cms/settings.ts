import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export type SiteSettings = {
  contact_email?: string;
  admin_email?: string;
  whatsapp_number?: string;
  phone_number?: string;
  office_location_text?: string;
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
