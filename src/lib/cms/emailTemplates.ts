import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

export type EmailTemplate = Tables<'email_templates'>;

export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  contact_notification: [
    'name',
    'email',
    'company',
    'phone',
    'country',
    'service_interest',
    'source_page',
    'message',
    'submission_id',
  ],
  contact_acknowledgement: ['name'],
};

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('email_templates')
    .select('*')
    .order('template_key', { ascending: true });
  return data ?? [];
}
