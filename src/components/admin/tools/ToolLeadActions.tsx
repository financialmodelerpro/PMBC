'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { SaveButton } from '@/components/admin/SaveButton';
import { ADMIN_COLORS, adminButtonGhost, adminInput, adminLabel, adminTextarea } from '@/lib/admin/styles';

type Status = 'new' | 'read' | 'responded' | 'archived';

/** Status, notes, resend and download for one tool lead. */
export function ToolLeadActions({ id, status, notes, email }: { id: string; status: Status; notes: string | null; email: string }) {
  const router = useRouter();
  const [s, setS] = useState<Status>(status);
  const [n, setN] = useState(notes ?? '');
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const dirty = s !== status || n !== (notes ?? '');

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tool-leads/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: s, notes: n || null }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || 'Save failed');
      setMessage({ tone: 'ok', text: 'Saved' });
      router.refresh();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    setResending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tool-leads/${id}/resend`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Resend failed');
      setMessage({ tone: 'ok', text: `Results email sent again to ${email}` });
      router.refresh();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Resend failed' });
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={adminLabel}>Status</span>
        <select value={s} onChange={(e) => setS(e.target.value as Status)} style={adminInput}>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="responded">Responded</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={adminLabel}>Notes (admin only)</span>
        <textarea value={n} onChange={(e) => setN(e.target.value)} rows={4} style={adminTextarea} />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <SaveButton onClick={save} saving={saving} disabled={!dirty}>
          {saving ? 'Saving' : 'Save'}
        </SaveButton>
        <button type="button" onClick={resend} disabled={resending} style={adminButtonGhost}>
          {resending ? 'Sending' : 'Resend results email'}
        </button>
        <a href={`/api/admin/tool-leads/${id}/pdf`} style={adminButtonGhost}>
          Download PDF
        </a>
      </div>
      {message && (
        <p role="status" style={{ margin: 0, fontSize: 13, color: message.tone === 'ok' ? ADMIN_COLORS.success : ADMIN_COLORS.danger }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
