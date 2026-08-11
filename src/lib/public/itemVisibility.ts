/**
 * Drops list items an author has marked hidden.
 *
 * Every PMBC section renderer that iterates a list runs its raw array through
 * this before mapping. It applies to PMBC's own content as much as to content
 * imported from FMP, which is the point: the rule belongs to the renderer, not
 * to any one source. A filter applied only on the import path would be one
 * `page_sections` edit away from being wrong.
 *
 * The convention is `visible: false` hides, and anything else shows. Absent
 * means visible, so every list authored before the flag existed is unaffected,
 * and a malformed value fails safe towards showing PMBC's own content rather
 * than silently blanking a section.
 *
 * Strings pass through untouched. Several PMBC lists hold plain strings
 * (`founder_credentials.items`, `service_detail.deliverables`) and a string
 * cannot carry a flag.
 */
export function visibleListItems(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
    return (item as Record<string, unknown>).visible !== false;
  });
}
