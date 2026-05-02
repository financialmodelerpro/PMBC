import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

export type EmailBranding = Tables<'email_branding'>;

export async function fetchEmailBranding(): Promise<EmailBranding | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('email_branding')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return data;
}
