import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchAllContent } from '@/lib/cms/content';
import { ADMIN_COLORS, adminPageMain } from '@/lib/admin/styles';

import { ContentEditor } from './ContentEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Content — PMBC Admin',
  robots: { index: false, follow: false },
};

export default async function ContentAdminPage() {
  // Header navigation lives in cms_content under (header_settings, nav_items) but
  // is edited via the dedicated /admin/header-settings UI. Hide that one row here
  // to avoid double-editing.
  const all = await fetchAllContent();
  const visible = all.filter(
    (r) => !(r.section === 'header_settings' && r.key === 'nav_items'),
  );

  // Service-detail content (one section per service slug, prefixed `service_`)
  // is grouped separately so the 9 service accordions don't visually drown
  // out the general header / footer / SEO sections.
  const serviceRows = visible.filter((r) => r.section.startsWith('service_'));
  const generalRows = visible.filter((r) => !r.section.startsWith('service_'));

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Content"
          description="Key-value content for the public site. Grouped by section. Header navigation is edited under Header Settings."
        />

        {generalRows.length > 0 && (
          <>
            <GroupHeading
              label="General"
              hint="Header, footer, contact info, SEO defaults."
            />
            <ContentEditor initial={generalRows} />
          </>
        )}

        {serviceRows.length > 0 && (
          <>
            <GroupHeading
              label="Service detail content"
              hint="One section per service. Edits here drive /services/[slug] pages."
            />
            <ContentEditor initial={serviceRows} />
          </>
        )}

        {generalRows.length === 0 && serviceRows.length === 0 && (
          <div
            style={{
              background: '#FFFFFF',
              border: `1px solid ${ADMIN_COLORS.border}`,
              borderRadius: 12,
              padding: 24,
              fontSize: 13,
              color: ADMIN_COLORS.textMuted,
            }}
          >
            No cms_content rows found. Run migration 006 (and 010 for service
            content) to seed defaults.
          </div>
        )}
      </div>
    </div>
  );
}

function GroupHeading({ label, hint }: { label: string; hint?: string }) {
  return (
    <div
      style={{
        margin: '24px 0 12px',
        paddingBottom: 8,
        borderBottom: `1px solid ${ADMIN_COLORS.border}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: ADMIN_COLORS.textMuted,
        }}
      >
        {label}
      </p>
      {hint && (
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: ADMIN_COLORS.textMicro,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
