import { ADMIN_COLORS } from '@/lib/admin/styles';

/**
 * Shown in place of data when a free tools table does not exist yet, so an
 * admin screen explains itself rather than showing an empty table or an error.
 */
export function MigrationNotice({ migration, table, effect }: { migration: string; table: string; effect: string }) {
  return (
    <div
      role="status"
      style={{
        background: ADMIN_COLORS.warningBg,
        color: ADMIN_COLORS.warning,
        border: '1px solid #F5D08A',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 20,
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <strong>Migration not applied.</strong> The <code>{table}</code> table does not exist yet. Apply{' '}
      <code>supabase/migrations/{migration}</code> in the Supabase SQL editor. {effect}
    </div>
  );
}
