/**
 * Reading one string of copy off a section's content blob.
 *
 * The rule, and the reason this is a function rather than `||` at each call
 * site: **absent and empty are different states.**
 *
 * - Key missing entirely: the section predates the field, or was added by hand
 *   in the builder. Fall back to the wording the page shipped with, so an older
 *   row still renders a complete page.
 * - Key present and empty: an operator cleared the field and saved. That is an
 *   instruction to remove the line, and the caller renders nothing.
 *
 * `||` collapses the two, which is the bug this replaces. Clearing the booking
 * callout on /contact in the page builder appeared to do nothing: the save went
 * through, the row held three empty strings, and the renderer put the shipped
 * defaults back on every request. From the operator's side that is
 * indistinguishable from a save that failed.
 *
 * The returned string is trimmed, so a field holding only whitespace counts as
 * cleared rather than as a line of blank text.
 */
export function sectionCopy(
  content: Record<string, unknown>,
  key: string,
  shipped: string,
): string {
  const value = content[key];
  return (typeof value === 'string' ? value : shipped).trim();
}
