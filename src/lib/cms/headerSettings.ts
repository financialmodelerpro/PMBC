import { createSupabaseServerClient } from '@/lib/supabase/server';

export type NavItem = { label: string; href: string };

export type HeaderConfig = {
  nav_items: NavItem[];
  cta_label: string;
  cta_href: string;
  show_cta: boolean;
  mobile_menu_enabled: boolean;
};

export const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  nav_items: [
    { label: 'Services', href: '/services' },
    { label: 'Sectors', href: '/sectors' },
    { label: 'Approach', href: '/approach' },
    { label: 'Network', href: '/network' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  cta_label: 'Start a Conversation',
  cta_href: '/contact',
  show_cta: true,
  mobile_menu_enabled: true,
};

export async function fetchHeaderConfig(): Promise<HeaderConfig> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_content')
    .select('value')
    .eq('section', 'header_settings')
    .eq('key', 'config')
    .maybeSingle();

  if (!data?.value) return DEFAULT_HEADER_CONFIG;
  try {
    const parsed = JSON.parse(data.value) as Partial<HeaderConfig>;
    return {
      ...DEFAULT_HEADER_CONFIG,
      ...parsed,
      nav_items:
        Array.isArray(parsed.nav_items) && parsed.nav_items.length > 0
          ? parsed.nav_items
          : DEFAULT_HEADER_CONFIG.nav_items,
    };
  } catch {
    return DEFAULT_HEADER_CONFIG;
  }
}
