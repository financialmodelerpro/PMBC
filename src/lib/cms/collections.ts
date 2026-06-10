import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];
export type ServiceRow = Tables['services']['Row'];
export type CaseStudyRow = Tables['case_studies']['Row'];
export type TeamMemberRow = Tables['team_members']['Row'];
export type ArticleRow = Tables['articles']['Row'];
export type TestimonialRow = Tables['testimonials']['Row'];

/**
 * Public, server-side reads for the advisory-firm collections. Each fetcher is
 * defensive: if the table does not exist yet (migrations not applied) or the
 * query fails, it returns an empty result so public pages degrade gracefully
 * rather than throwing.
 */

export async function fetchPublishedServices(): Promise<ServiceRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('status', 'published')
      .order('display_order', { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchPublishedCaseStudies(): Promise<CaseStudyRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('case_studies')
      .select('*')
      .eq('status', 'published')
      .order('display_order', { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchCaseStudyBySlug(slug: string): Promise<CaseStudyRow | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('case_studies')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function fetchVisibleTeam(): Promise<TeamMemberRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('visible', true)
      .order('display_order', { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchPublishedArticles(): Promise<ArticleRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .order('featured', { ascending: false })
      .order('published_at', { ascending: false });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchArticleBySlug(slug: string): Promise<ArticleRow | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function fetchApprovedTestimonials(
  opts: { onlyLanding?: boolean } = {},
): Promise<TestimonialRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    let query = supabase
      .from('testimonials')
      .select('*')
      .eq('status', 'approved');
    if (opts.onlyLanding) query = query.eq('show_on_landing', true);
    const { data, error } = await query.order('display_order', { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
