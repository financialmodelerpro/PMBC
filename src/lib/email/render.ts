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
      return escapeHtml(vars[key] ?? '');
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
