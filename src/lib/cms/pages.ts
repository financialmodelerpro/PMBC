import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

export type CmsPage = Tables<'cms_pages'>;
export type PageSection = Tables<'page_sections'>;

export async function fetchPages(): Promise<CmsPage[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_pages')
    .select('*')
    .order('slug', { ascending: true });
  return data ?? [];
}

export async function fetchPage(slug: string): Promise<CmsPage | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_pages')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

export async function fetchPageSections(slug: string, opts: { onlyVisible?: boolean } = {}): Promise<PageSection[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('page_sections')
    .select('*')
    .eq('page_slug', slug)
    .order('display_order', { ascending: true });
  if (opts.onlyVisible) {
    query = query.eq('visible', true);
  }
  const { data } = await query;
  return data ?? [];
}
