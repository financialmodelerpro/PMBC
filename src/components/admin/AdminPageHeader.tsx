import { ADMIN_COLORS } from '@/lib/admin/styles';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header
      style={{
        marginBottom: 28,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.primary,
            margin: 0,
          }}
        >
          {eyebrow}
        </p>
        <h1
          style={{
            margin: '6px 0 0',
            fontSize: 24,
            fontWeight: 800,
            color: ADMIN_COLORS.primaryDeep,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 13,
              color: ADMIN_COLORS.textMuted,
              maxWidth: 720,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </header>
  );
}
