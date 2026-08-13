'use client';

import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { FooterLinksManager } from '@/components/admin/FooterLinksManager';
import { ADMIN_COLORS, adminPageMain } from '@/lib/admin/styles';

export default function AdminFooterLinksPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Footer Links"
          description="The links in the footer, and whether each one appears. Edit a label or target in the row and press Save. Column, visibility and order save as soon as you change them."
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
          Firm links render as a list; Contact links render under the contact
          details, beside the email address and location. Case Studies, Insights
          and Team ship hidden because those collections are empty: turn each on
          once its page has something on it. The navbar is edited separately in{' '}
          <Link
            href="/admin/pages"
            style={{ color: ADMIN_COLORS.primaryDeep, fontWeight: 600 }}
          >
            Pages &amp; Nav
          </Link>
          , and the footer logo and copy live in{' '}
          <Link
            href="/admin/header-settings"
            style={{ color: ADMIN_COLORS.primaryDeep, fontWeight: 600 }}
          >
            Header Settings
          </Link>
          . Privacy and Terms sit in the bottom strip and are not editable here.
        </div>

        <FooterLinksManager />
      </div>
    </div>
  );
}
