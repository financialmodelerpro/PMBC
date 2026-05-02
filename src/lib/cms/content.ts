import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

export type ContentRow = Tables<'cms_content'>;

export async function fetchContentBySection(
  section: string,
): Promise<Record<string, string>> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_content')
    .select('key, value')
    .eq('section', section);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
}

export async function fetchAllContent(): Promise<ContentRow[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_content')
    .select('*')
    .order('section', { ascending: true })
    .order('key', { ascending: true });
  return data ?? [];
}
