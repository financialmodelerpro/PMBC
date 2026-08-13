/**
 * Replaces `{{variable}}` placeholders with their values. Unknown variables
 * are left in place. Values are HTML-escaped so user input from the contact
 * form can't break out of the surrounding markup.
 */
export function renderTemplate(
  source: string,
  vars: Record<string, string | undefined>,
): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const escaped = escapeHtml(vars[key] ?? '');
      // A variable whose name ends in `_html` keeps its line breaks. It is
      // still escaped first, so this adds markup we generate and never markup
      // the sender wrote: the only tag that can reach the output is the <br />
      // put there below. Without it a message typed in paragraphs arrives as
      // one unbroken block, since HTML collapses newlines.
      return key.endsWith('_html') ? escaped.replace(/\r?\n/g, '<br />') : escaped;
    }
    return match;
  });
}

export function renderSubject(
  source: string,
  vars: Record<string, string | undefined>,
): string {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? '';
    }
    return match;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
