import type { Metadata } from 'next';
import { FileText, LayoutTemplate, Inbox, Clock } from 'lucide-react';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Dashboard — PMBC Admin',
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
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-neutral-500">
          {label}
        </p>
        <Icon className="h-4 w-4 text-[#1B3A5F]" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[#0F1B2D]">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const stats = await loadStats();
  const fmt = (n: number | null) => (n === null ? '—' : String(n));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#1B3A5F]">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0F1B2D]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Overview of CMS content and recent activity. Detail panels will come online as features ship.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
          <h2 className="text-sm font-semibold text-[#0F1B2D]">
            Recent Contact Submissions
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            No data yet. Submissions table will be wired up in a later phase.
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
          <h2 className="text-sm font-semibold text-[#0F1B2D]">Quick Actions</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Page builder, content editor, and branding controls will appear here as Phase 3 lands.
          </p>
        </div>
      </section>
    </div>
  );
}
