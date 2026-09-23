'use client';

import { useEffect, useRef } from 'react';

import { ADMIN_COLORS } from '@/lib/admin/styles';

/**
 * The website chat as a visitor would see it, run against the admin preview
 * endpoint: test conversations, allowed in mock mode, no alert emails. Loads
 * the same script the public site would load.
 */
export function ChatPreview({ page }: { page: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = '';
    const w = window as unknown as { __pmbcChat?: boolean };
    w.__pmbcChat = false;
    const s = document.createElement('script');
    s.src = `/api/growth/widget?v=${Date.now()}`;
    s.dataset.endpoint = '/api/admin/growth/chat-preview';
    s.dataset.container = 'pmbc-chat-preview';
    s.dataset.path = page;
    s.defer = true;
    document.body.appendChild(s);
    return () => {
      s.remove();
      w.__pmbcChat = false;
    };
  }, [page]);
  return (
    <div>
      <div id="pmbc-chat-preview" ref={host} />
      <p style={{ margin: '8px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>Preview conversations are saved as test rows and never alert you.</p>
    </div>
  );
}
