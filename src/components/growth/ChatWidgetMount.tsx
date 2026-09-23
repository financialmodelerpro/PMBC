import { chatOpeningSettings, chatWidgetShown, type ChatOpening } from '@/lib/growth/chat';

/**
 * Where the website chat joins the public layout (Unit 4.2, 2026-09-23). The
 * public layout wraps every public page, the home page included, so the chat
 * appears on all of them when it is on.
 *
 * A server component with no client code. It renders nothing at all unless
 * the chat is switched on in Growth Settings (off by default, migration 090)
 * and a real Anthropic key is set; then it adds one deferred script tag that
 * carries how the chat opens by itself (migration 095). The answer is cached
 * for a minute per server instance so the check adds no database read to most
 * page views, and any failure means off.
 */

let cached: { on: boolean; opening: ChatOpening | null; at: number } | null = null;
const TTL_MS = 60_000;

async function mountState(): Promise<{ on: boolean; opening: ChatOpening | null }> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  let on = false;
  let opening: ChatOpening | null = null;
  try {
    on = await chatWidgetShown();
    if (on) opening = await chatOpeningSettings();
  } catch {
    on = false;
  }
  cached = { on, opening, at: Date.now() };
  return cached;
}

export async function ChatWidgetMount() {
  const { on, opening } = await mountState();
  if (!on || !opening) return null;
  return <script src="/api/growth/widget" defer data-auto-open={opening.autoOpen ? '1' : '0'} data-delay={String(opening.delaySeconds)} data-scroll={String(opening.scrollPercent)} />;
}
