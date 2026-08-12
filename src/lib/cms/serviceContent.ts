import { fetchContentBySection } from './content';
import { readSectionMedia, type SectionMediaValue } from './sectionMedia';
import { SERVICES, type ServiceConfig } from '@/config/services';

export type ServiceDetailFields = {
  full_description_html: string;
  deliverables: string[];
  timeline_text: string;
  target_audience_text: string;
  /**
   * The same optional shared media every `page_sections` row supports. These
   * nine pages are driven by `cms_content` rather than `page_sections`, so the
   * keys are read from the `service_<slug>` namespace instead, and handed to
   * the renderer in the same shape.
   */
  media: SectionMediaValue | null;
};

export const SERVICE_CONTENT_KEYS = [
  'full_description',
  'deliverables',
  'timeline_text',
  'target_audience_text',
  'media_url',
  'media_type',
  'media_poster_url',
  'media_position',
  'media_caption',
  'media_max_height',
] as const;

/** Section name pattern in `cms_content` for a given service slug. */
export function serviceContentSection(slug: string): string {
  return `service_${slug}`;
}

export function findService(slug: string): ServiceConfig | null {
  return SERVICES.find((s) => s.slug === slug) ?? null;
}

/**
 * Parses the `deliverables` cms_content value robustly: tries JSON.parse
 * first (for arrays seeded as JSON), falls back to splitting on newlines so
 * an admin can also edit the value as a plain newline-separated list. Empty
 * lines are dropped.
 */
function parseDeliverables(raw: string): string[] {
  const text = (raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v.length > 0);
      }
    } catch {
      // Fall through to newline split.
    }
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function fetchServiceDetailFields(
  slug: string,
): Promise<ServiceDetailFields> {
  const rows = await fetchContentBySection(serviceContentSection(slug));
  return {
    full_description_html: rows.full_description ?? '',
    deliverables: parseDeliverables(rows.deliverables ?? ''),
    timeline_text: rows.timeline_text ?? '',
    target_audience_text: rows.target_audience_text ?? '',
    // cms_content stores everything as TEXT, so the playback booleans arrive as
    // the strings "true" / "false". readSectionMedia handles both, and returns
    // null when media_url is blank, which is the state all nine ship in.
    media: readSectionMedia(rows),
  };
}
