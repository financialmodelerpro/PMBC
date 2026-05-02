import type { Json, Tables } from '@/types/database';

export type LocalSection = {
  id: string;
  page_slug: string;
  section_type: string;
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  display_order: number;
  visible: boolean;
};

function asObject(v: Json | null | undefined): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

export function sectionFromRow(row: Tables<'page_sections'>): LocalSection {
  return {
    id: row.id,
    page_slug: row.page_slug,
    section_type: row.section_type,
    content: asObject(row.content),
    styles: asObject(row.styles),
    display_order: row.display_order,
    visible: row.visible,
  };
}
