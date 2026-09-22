'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ADMIN_COLORS, adminBadge, adminButtonGhost } from '@/lib/admin/styles';

type Result =
  | { ok: true; text: string; mock: boolean; model: string; costUsd: number }
  | { ok: false; reason: string; message: string; mock: boolean };

/**
 * Runs one test call through the AI layer and shows what came back. Mock
 * output is labelled as mock, in a badge and in the text itself.
 */
export function AiTestCall() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/growth/ai/test', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as Result & { error?: string };
      if (!res.ok) throw new Error(data.error || 'The test call failed');
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The test call failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <button type="button" onClick={run} disabled={busy} style={adminButtonGhost}>
          {busy ? 'Running' : 'Run a test AI call'}
        </button>
      </div>
      {error && <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.danger }}>{error}</p>}
      {result && (
        <div style={{ border: `1px solid ${ADMIN_COLORS.border}`, borderRadius: 8, padding: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            {result.mock && <span style={adminBadge('warning')}>Mock output</span>}
            <span style={adminBadge(result.ok ? 'success' : 'danger')}>{result.ok ? 'Succeeded' : 'Refused'}</span>
            {result.ok && (
              <span style={{ color: ADMIN_COLORS.textMuted, fontSize: 12 }}>
                {result.model}, USD {result.costUsd.toFixed(6)}
              </span>
            )}
          </div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: ADMIN_COLORS.textBody }}>{result.ok ? result.text : result.message}</p>
        </div>
      )}
    </div>
  );
}
