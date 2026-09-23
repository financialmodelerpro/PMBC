/**
 * Reading JSON out of an AI answer (from Phase 2, 2026-09-23). Pure.
 *
 * Agents ask for one JSON object. The answer may carry the mock label, a code
 * fence or a sentence around it; the object is taken from the first `{` to
 * its matching `}`. Anything unreadable returns null and the agent refuses to
 * use the answer.
 */

export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Removes anything that looks like an email address: agents never supply emails. */
export function stripEmails(text: string): string {
  return text.replace(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi, '[email removed]');
}

/** The approved Knowledge Base as compact text for a system prompt. */
export function knowledgeText(items: { title: string; content: Record<string, unknown> }[]): string {
  return items
    .map((i) => {
      const body = Object.entries(i.content)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : String(v ?? '')}`)
        .join('\n');
      return `## ${i.title}\n${body}`;
    })
    .join('\n\n');
}
