import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { adminPageMain } from '@/lib/admin/styles';

export const metadata: Metadata = {
  title: 'Audit Log | PMBC Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The table, filters, pagination and diff dialog live in AuditLogViewer
 * (parity Phase 7). This page is just the shell. Data is fetched client side
 * through /api/admin/audit-log so filtering and paging do not require a full
 * server round trip per interaction.
 */
export default function AdminAuditPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="System"
          title="Audit Log"
          description="Every admin write, most recent first. Filter by admin, action or date, and open any entry to see what changed."
        />
        <AuditLogViewer />
      </div>
    </div>
  );
}
