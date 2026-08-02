'use client';

import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SitePagesManager } from '@/components/admin/SitePagesManager';
import { ADMIN_COLORS, adminPageMain } from '@/lib/admin/styles';

export default function AdminPagesNavPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Pages and Nav"
          description="The navigation menu that drives the public navbar. Edit a label or link in the row and press Save. Order, visibility and pinning save as soon as you change them. Editing page content happens in Page Builder."
        />

        <div
          style={{
            marginBottom: 18,
            padding: '12px 16px',
            background: '#FFFFFF',
            border: `1px solid ${ADMIN_COLORS.border}`,
            borderRadius: 10,
            fontSize: 12.5,
            color: ADMIN_COLORS.textMuted,
            lineHeight: 1.6,
          }}
        >
          This controls navbar links only. To edit the sections on a page, open{' '}
          <Link
            href="/admin/page-builder"
            style={{ color: ADMIN_COLORS.primaryDeep, fontWeight: 600 }}
          >
            Page Builder
          </Link>
          . The header CTA button and mobile-menu toggle live in{' '}
          <Link
            href="/admin/header-settings"
            style={{ color: ADMIN_COLORS.primaryDeep, fontWeight: 600 }}
          >
            Header Settings
          </Link>
          . A pinned item stays in the navbar: its Visible switch locks and it
          cannot be deleted until it is unpinned.
        </div>

        <SitePagesManager />
      </div>
    </div>
  );
}
