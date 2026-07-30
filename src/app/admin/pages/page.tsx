'use client';

import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  CollectionManager,
  type FieldDef,
  type ListColumn,
} from '@/components/admin/CollectionManager';
import { ADMIN_COLORS, adminPageMain } from '@/lib/admin/styles';

const FIELDS: FieldDef[] = [
  {
    key: 'label',
    label: 'Menu label',
    type: 'text',
    hint: 'Shown in the navbar',
    placeholder: 'Services',
  },
  {
    key: 'href',
    label: 'Link target',
    type: 'text',
    hint: 'Relative path such as /services, or a full external URL',
    placeholder: '/services',
  },
  { key: 'display_order', label: 'Display order', type: 'number' },
  { key: 'visible', label: 'Visible in navbar', type: 'checkbox' },
];

const COLUMNS: ListColumn[] = [
  { key: 'label', label: 'Label' },
  { key: 'href', label: 'Link' },
  {
    key: 'visible',
    label: 'Visible',
    badge: true,
    width: 110,
    render: (r) => (r.visible === false ? 'hidden' : 'visible'),
  },
];

export default function AdminPagesNavPage() {
  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Pages and Nav"
          description="The navigation menu that drives the public navbar. Reorder items, hide them, or point them somewhere else. Editing page content happens in Page Builder."
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
          .
        </div>

        <CollectionManager
          apiBase="/api/admin/site-pages"
          fields={FIELDS}
          listColumns={COLUMNS}
          enableReorder
          newDefaults={{ label: '', href: '/', display_order: 0, visible: true }}
          itemLabel={(r) => (r.label as string) || 'Menu item'}
          statusTone={(r) => (r.visible === false ? 'neutral' : 'success')}
          emptyHint="No navigation items. Add the first navbar link."
        />
      </div>
    </div>
  );
}
