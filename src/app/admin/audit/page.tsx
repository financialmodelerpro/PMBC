import type { Metadata } from 'next';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  ADMIN_COLORS,
  adminBadge,
  adminPageMain,
} from '@/lib/admin/styles';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export const metadata: Metadata = {
  title: 'Audit Log | PMBC Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string | null;
  admin_users: { name: string | null; email: string | null } | null;
};

async function loadAudit(): Promise<{ rows: AuditRow[]; error: string | null }> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('audit_log')
      .select('id, action, entity_type, entity_id, created_at, admin_users(name, email)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as unknown as AuditRow[], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : 'Failed to load' };
  }
}

function actionTone(action: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (action === 'create' || action === 'upload') return 'success';
  if (action === 'delete') return 'danger';
  if (action === 'update') return 'warning';
  return 'neutral';
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminAuditPage() {
  const { rows, error } = await loadAudit();

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="System"
          title="Audit Log"
          description="Every admin write, most recent first. The latest 200 events are shown."
        />

        {error && (
          <div style={{ ...adminBadge('danger'), display: 'block', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ background: '#fff', border: `1px solid ${ADMIN_COLORS.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {rows.length === 0 && !error ? (
            <div style={{ padding: 44, textAlign: 'center', color: ADMIN_COLORS.textMuted, fontSize: 13 }}>
              No activity recorded yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: ADMIN_COLORS.altBg }}>
                  <th style={th}>When</th>
                  <th style={th}>Who</th>
                  <th style={th}>Action</th>
                  <th style={th}>Entity</th>
                  <th style={th}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...td, color: ADMIN_COLORS.textMuted, whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                    <td style={td}>
                      {r.admin_users?.name || r.admin_users?.email || 'System'}
                    </td>
                    <td style={td}>
                      <span style={adminBadge(actionTone(r.action))}>{r.action}</span>
                    </td>
                    <td style={td}>{r.entity_type}</td>
                    <td style={{ ...td, color: ADMIN_COLORS.textMuted, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {r.entity_id || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '11px 16px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: ADMIN_COLORS.textMuted,
  textAlign: 'left',
  borderBottom: `1px solid ${ADMIN_COLORS.border}`,
};

const td: React.CSSProperties = {
  padding: '11px 16px',
  fontSize: 13,
  color: ADMIN_COLORS.textBody,
  borderBottom: `1px solid ${ADMIN_COLORS.borderSoft}`,
};
