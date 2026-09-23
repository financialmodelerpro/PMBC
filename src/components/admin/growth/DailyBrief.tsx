import Link from 'next/link';

import { ADMIN_COLORS, adminBadge, adminCard } from '@/lib/admin/styles';
import { dailyBrief } from '@/lib/growth/brief';
import { day } from '@/lib/growth/format';

const TONE = { 1: 'danger', 2: 'warning', 3: 'neutral', 4: 'neutral' } as const;

/** Today's priorities, each with the recommended next action and why. */
export async function DailyBrief() {
  const b = await dailyBrief();
  return (
    <section style={{ ...adminCard, marginBottom: 16 }} aria-labelledby="daily-brief">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 id="daily-brief" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
          Daily Brief
        </h2>
        <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{day(b.date)}, Riyadh</span>
      </div>
      {b.items.length === 0 ? (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>Nothing needs you today.</p>
      ) : (
        <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {b.items.map((i, n) => (
            <li key={`${i.kind}-${n}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start', fontSize: 13 }}>
              <span style={adminBadge(TONE[i.priority as 1 | 2 | 3 | 4] ?? 'neutral')}>{i.priority === 1 ? 'Now' : i.priority === 2 ? 'Today' : 'Soon'}</span>
              <span>
                <Link href={i.href} style={{ fontWeight: 700 }}>
                  {i.title}
                </Link>
                <span style={{ display: 'block' }}>{i.action}</span>
                <span style={{ display: 'block', fontSize: 12, color: ADMIN_COLORS.textMuted }}>Why: {i.reason}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
