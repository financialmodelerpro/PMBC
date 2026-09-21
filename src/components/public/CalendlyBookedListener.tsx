'use client';

import { useEffect } from 'react';

/**
 * Reports a meeting booked in the embedded Calendly widget (its `calendly.event_scheduled` message)
 * so the follow-up reminders stop for the lead the visitor came from (since 2026-09-21). Only
 * messages from Calendly are read, and each booking is reported once.
 */
export function CalendlyBookedListener() {
  useEffect(() => {
    const seen = new Set<string>();
    const onMessage = (e: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)*calendly\.com$/.test(e.origin)) return;
      const data = e.data as { event?: string; payload?: { event?: { uri?: string } } } | null;
      if (data?.event !== 'calendly.event_scheduled') return;
      const uri = data.payload?.event?.uri ?? 'booked';
      if (seen.has(uri)) return;
      seen.add(uri);
      void fetch('/api/tools/book/scheduled', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventUri: uri }), keepalive: true }).catch(() => {});
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return null;
}
