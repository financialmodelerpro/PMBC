'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useAdminRole } from '@/components/admin/AdminRoleProvider';
import { ADMIN_COLORS, adminBadge } from '@/lib/admin/styles';

/**
 * Live or Hidden for one tool, behind a confirmation that states exactly what
 * changes on the public site. Admin only; editors see the status and why they
 * cannot change it.
 */
export function VisibilityToggle({
  slug,
  name,
  live,
  canToggle,
  disabledReason,
}: {
  slug: string;
  name: string;
  live: boolean;
  canToggle: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const role = useAdminRole();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = live ? 'hidden' : 'live';
  const allowed = canToggle && role === 'admin';

  async function apply() {
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tools/${slug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: target }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change visibility');
    } finally {
      setBusy(false);
    }
  }

  const title = !canToggle ? disabledReason : role !== 'admin' ? 'Only an admin can change tool visibility.' : undefined;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={adminBadge(live ? 'success' : 'neutral')}>{live ? 'Live' : 'Hidden'}</span>
        <button
          type="button"
          role="switch"
          aria-checked={live}
          aria-label={`${name} is ${live ? 'Live' : 'Hidden'}. ${allowed ? `Switch to ${target}` : ''}`}
          title={title}
          disabled={!allowed || busy}
          onClick={() => setConfirming(true)}
          style={{
            position: 'relative',
            width: 44,
            height: 24,
            borderRadius: 999,
            border: 'none',
            cursor: allowed && !busy ? 'pointer' : 'not-allowed',
            opacity: allowed ? 1 : 0.5,
            background: live ? ADMIN_COLORS.save : '#CBD5E1',
            transition: 'background 0.15s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: live ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: 999,
              background: '#FFFFFF',
              transition: 'left 0.15s',
            }}
          />
        </button>
        {busy && <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>Saving</span>}
      </div>
      {error && <span style={{ fontSize: 12, color: ADMIN_COLORS.danger }}>{error}</span>}
      <ConfirmDialog
        open={confirming}
        title={live ? `Hide ${name}?` : `Switch ${name} Live?`}
        body={
          live
            ? `The public page will return 404 and be removed from the sitemap, and its service page call to action will disappear. The footer Free Tools link will disappear if no other tool is Live. Leads already received are kept.`
            : `The public page will open to everyone and be added to the sitemap, its service page call to action will appear, and the footer will show a Free Tools link. Submissions will be saved as real leads and emailed.`
        }
        confirmLabel={live ? 'Hide tool' : 'Switch Live'}
        destructive={live}
        onConfirm={apply}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
