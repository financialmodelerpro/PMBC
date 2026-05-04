import type { Metadata } from 'next';
import { FileText, LayoutTemplate, Inbox, Clock } from 'lucide-react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  ADMIN_COLORS,
  adminCard,
  adminPageMain,
} from '@/lib/admin/styles';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export const metadata: Metadata = {
  title: 'Dashboard | PMBC Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type DashboardStats = {
  totalPages: number | null;
  totalSections: number | null;
  newSubmissions: number | null;
  lastUpdatedIso: string | null;
};

async function loadStats(): Promise<DashboardStats> {
  try {
    const supabase = createSupabaseServerClient();
    const [pages, sections, submissions, lastPage] = await Promise.all([
      supabase.from('cms_pages').select('id', { count: 'exact', head: true }),
      supabase.from('page_sections').select('id', { count: 'exact', head: true }),
      supabase
        .from('contact_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new'),
      supabase
        .from('cms_pages')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      totalPages: pages.count ?? 0,
      totalSections: sections.count ?? 0,
      newSubmissions: submissions.count ?? 0,
      lastUpdatedIso: lastPage.data?.updated_at ?? null,
    };
  } catch {
    return {
      totalPages: null,
      totalSections: null,
      newSubmissions: null,
      lastUpdatedIso: null,
    };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'No data yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No data yet';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({
  label,
  value,
  hint,
  Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof FileText;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${ADMIN_COLORS.borderSoft}`,
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMuted,
          }}
        >
          {label}
        </p>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#EAF1F9',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: ADMIN_COLORS.primary,
          }}
        >
          <Icon size={17} />
        </div>
      </div>
      <p
        style={{
          margin: '14px 0 0',
          fontSize: 32,
          fontWeight: 800,
          color: ADMIN_COLORS.primaryDeep,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </p>
      {hint && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const stats = await loadStats();
  const fmt = (n: number | null) => (n === null ? '-' : String(n));

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Dashboard"
          description="Overview of CMS content and recent activity. Detail panels will come online as features ship."
        />

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <StatCard
            label="Total Pages"
            value={fmt(stats.totalPages)}
            hint="CMS-managed pages"
            Icon={FileText}
          />
          <StatCard
            label="Total Sections"
            value={fmt(stats.totalSections)}
            hint="Across all pages"
            Icon={LayoutTemplate}
          />
          <StatCard
            label="New Submissions"
            value={fmt(stats.newSubmissions)}
            hint="Awaiting response"
            Icon={Inbox}
          />
          <StatCard
            label="Last Page Updated"
            value={formatDate(stats.lastUpdatedIso)}
            Icon={Clock}
          />
        </div>

        <section
          style={{
            marginTop: 32,
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          }}
        >
          <div style={adminCard}>
            <h2
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: ADMIN_COLORS.textHeading,
              }}
            >
              Recent Contact Submissions
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>
              No data yet. Submissions table will be wired up in a later phase.
            </p>
          </div>
          <div style={adminCard}>
            <h2
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: ADMIN_COLORS.textHeading,
              }}
            >
              Quick Actions
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: ADMIN_COLORS.textMuted }}>
              Page builder, content editor, and branding controls are reachable from the sidebar.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
