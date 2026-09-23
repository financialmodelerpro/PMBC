import { ADMIN_COLORS, adminBadge } from '@/lib/admin/styles';
import type { TimelineRow } from '@/lib/growth/activity';
import { dateTime } from '@/lib/growth/format';

const ACTOR: Record<string, string> = { admin: 'Ahmad', ai: 'AI', system: 'System' };

/** A record's full history, oldest first, in insertion order. */
export function Timeline({ rows, empty = 'Nothing recorded yet.' }: { rows: TimelineRow[]; empty?: string }) {
  if (!rows.length) return <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>{empty}</p>;
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => (
        <li key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 150px) 1fr', gap: 12, fontSize: 13, borderLeft: `2px solid ${ADMIN_COLORS.borderSoft}`, paddingLeft: 10 }}>
          <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
            {dateTime(r.created_at)}
            {r.metadata && (r.metadata as { imported?: boolean }).imported ? ' (imported)' : ''}
          </span>
          <span>
            <span style={{ ...adminBadge(r.actor_type === 'ai' ? 'warning' : 'neutral'), marginRight: 6 }}>{ACTOR[r.actor_type] ?? r.actor_type}</span>
            {r.summary ?? r.action}
            {r.is_test && <span style={{ ...adminBadge('neutral'), marginLeft: 6 }}>Test</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
