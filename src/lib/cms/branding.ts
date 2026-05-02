import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

export type BrandingConfig = Tables<'branding_config'>;

export async function fetchBranding(): Promise<BrandingConfig | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('branding_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return data;
}
