import { publicChatAvailable } from '@/lib/growth/chat';

/**
 * Where the website chat joins the public layout (Unit 4.2, 2026-09-23).
 *
 * A server component with no client code. It renders nothing at all unless
 * the chat is switched on in Growth Settings (off by default, migration 090)
 * and a real Anthropic key is set; then it adds one deferred script tag. The
 * answer is cached for a minute per server instance so the check adds no
 * database read to most page views, and any failure means off.
 */

let cached: { on: boolean; at: number } | null = null;
const TTL_MS = 60_000;

async function isOn(): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.on;
  let on = false;
  try {
    on = await publicChatAvailable();
  } catch {
    on = false;
  }
  cached = { on, at: Date.now() };
  return on;
}

export async function ChatWidgetMount() {
  if (!(await isOn())) return null;
  return <script src="/api/growth/widget" defer />;
}
