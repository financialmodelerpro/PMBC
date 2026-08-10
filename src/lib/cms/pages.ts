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

/**
 * The founder portrait URL, read from whichever `founder_hero` section carries
 * one (most recently updated first).
 *
 * There is no shared founder-photo column in `branding_config`, `site_settings`
 * or `team_members`: each section owns its own `photo_url` by design. So any
 * surface outside the page builder that wants the portrait has to read it from
 * a section rather than from a settings key. This is the same source and the
 * same precedence `scripts/sync-founder-photo.mjs` uses, so the two never
 * disagree about which image is the current one.
 *
 * Returns null when no portrait has been uploaded yet, which callers should
 * treat as "render the fallback", not as an error.
 */
export async function fetchFounderPhotoUrl(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('page_sections')
    .select('content, updated_at')
    .eq('section_type', 'founder_hero')
    .order('updated_at', { ascending: false });

  for (const row of data ?? []) {
    const content = row.content;
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const url = (content as Record<string, unknown>).photo_url;
      if (typeof url === 'string' && url.trim() !== '') return url.trim();
    }
  }
  return null;
}
