import Link from 'next/link';

import { ADMIN_COLORS } from '@/lib/admin/styles';

const TABS = [
  { key: 'settings', label: 'Limits, budget and retention', href: '/admin/growth/settings' },
  { key: 'suppression', label: 'Suppression list', href: '/admin/growth/settings/suppression' },
  { key: 'audit', label: 'Audit log', href: '/admin/growth/settings/audit' },
] as const;

/** The three parts of Growth Settings. Wraps on a narrow screen. */
export function SettingsTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <nav aria-label="Settings sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? 'page' : undefined}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            color: t.key === active ? ADMIN_COLORS.primary : ADMIN_COLORS.textMuted,
            borderBottom: `2px solid ${t.key === active ? ADMIN_COLORS.accent : 'transparent'}`,
            marginBottom: -1,
          }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
