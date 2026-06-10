import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight,
  FileText,
  FolderKanban,
  Inbox,
  LayoutTemplate,
  Mail,
  Palette,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ADMIN_COLORS, adminBadge } from '@/lib/admin/styles';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export const metadata: Metadata = {
  title: 'Dashboard | PMBC Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  service_interest: string | null;
  status: string | null;
  created_at: string | null;
};

type DashboardData = {
  newLeads: number | null;
  leadsThisMonth: number | null;
  totalLeads: number | null;
  totalPages: number | null;
  totalSections: number | null;
  recentLeads: LeadRow[];
  lastUpdatedIso: string | null;
  publishedServices: number | null;
  publishedCaseStudies: number | null;
  publishedInsights: number | null;
  approvedTestimonials: number | null;
  teamMembers: number | null;
};

async function countWhere(
  table: string,
  eq?: [string, string],
): Promise<number | null> {
  try {
    // Loosely typed: these collection tables may not exist until their
    // migrations are applied, so a failure returns null rather than throwing.
    const supabase = createSupabaseServerClient() as unknown as SupabaseClient;
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    if (eq) q = q.eq(eq[0], eq[1]);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

async function loadDashboard(): Promise<DashboardData> {
  const empty: DashboardData = {
    newLeads: null,
    leadsThisMonth: null,
    totalLeads: null,
    totalPages: null,
    totalSections: null,
    recentLeads: [],
    lastUpdatedIso: null,
    publishedServices: null,
    publishedCaseStudies: null,
    publishedInsights: null,
    approvedTestimonials: null,
    teamMembers: null,
  };

  const [
    publishedServices,
    publishedCaseStudies,
    publishedInsights,
    approvedTestimonials,
    teamMembers,
  ] = await Promise.all([
    countWhere('services', ['status', 'published']),
    countWhere('case_studies', ['status', 'published']),
    countWhere('articles', ['status', 'published']),
    countWhere('testimonials', ['status', 'approved']),
    countWhere('team_members', ['visible', 'true']),
  ]);

  try {
    const supabase = createSupabaseServerClient();
    const [newLeads, monthLeads, totalLeads, pages, sections, recent, lastPage] =
      await Promise.all([
        supabase
          .from('contact_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new'),
        supabase
          .from('contact_submissions')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonthIso()),
        supabase.from('contact_submissions').select('id', { count: 'exact', head: true }),
        supabase.from('cms_pages').select('id', { count: 'exact', head: true }),
        supabase.from('page_sections').select('id', { count: 'exact', head: true }),
        supabase
          .from('contact_submissions')
          .select('id, name, email, service_interest, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('cms_pages')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    return {
      newLeads: newLeads.count ?? 0,
      leadsThisMonth: monthLeads.count ?? 0,
      totalLeads: totalLeads.count ?? 0,
      totalPages: pages.count ?? 0,
      totalSections: sections.count ?? 0,
      recentLeads: (recent.data ?? []) as LeadRow[],
      lastUpdatedIso: lastPage.data?.updated_at ?? null,
      publishedServices,
      publishedCaseStudies,
      publishedInsights,
      approvedTestimonials,
      teamMembers,
    };
  } catch {
    return {
      ...empty,
      publishedServices,
      publishedCaseStudies,
      publishedInsights,
      approvedTestimonials,
      teamMembers,
    };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'No activity yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No activity yet';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function leadStatusTone(status: string | null): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'new':
      return 'warning';
    case 'responded':
      return 'success';
    case 'archived':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function StatCard({
  label,
  value,
  hint,
  Icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof FileText;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      style={{
        background: accent ? ADMIN_COLORS.primaryDeep : '#FFFFFF',
        border: `1px solid ${accent ? ADMIN_COLORS.primaryDeep : ADMIN_COLORS.borderSoft}`,
        borderRadius: 14,
        padding: '20px 22px',
        height: '100%',
        boxSizing: 'border-box',
        boxShadow: '0 1px 2px rgba(15,37,64,0.04)',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
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
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: accent ? 'rgba(255,255,255,0.6)' : ADMIN_COLORS.textMuted,
          }}
        >
          {label}
        </p>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: accent ? 'rgba(212,169,58,0.18)' : '#EAF1F9',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent ? ADMIN_COLORS.accent : ADMIN_COLORS.primary,
          }}
        >
          <Icon size={16} />
        </div>
      </div>
      <p
        style={{
          margin: '14px 0 0',
          fontSize: 34,
          fontWeight: 800,
          color: accent ? '#FFFFFF' : ADMIN_COLORS.primaryDeep,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {hint && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            color: accent ? 'rgba(255,255,255,0.55)' : ADMIN_COLORS.textMuted,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

const QUICK_ACTIONS: Array<{
  label: string;
  desc: string;
  href: string;
  Icon: typeof FileText;
}> = [
  {
    label: 'View Leads',
    desc: 'Triage inbound inquiries',
    href: '/admin/contact-submissions',
    Icon: Inbox,
  },
  {
    label: 'Edit Home Page',
    desc: 'Reorder and edit sections',
    href: '/admin/page-builder/home',
    Icon: LayoutTemplate,
  },
  {
    label: 'Page Content',
    desc: 'Global text and copy',
    href: '/admin/content',
    Icon: FileText,
  },
  {
    label: 'Branding',
    desc: 'Logo, colours, tagline',
    href: '/admin/branding',
    Icon: Palette,
  },
  {
    label: 'Email Templates',
    desc: 'Notifications and replies',
    href: '/admin/email-templates',
    Icon: Mail,
  },
  {
    label: 'Site Settings',
    desc: 'SEO, analytics, config',
    href: '/admin/settings',
    Icon: Settings,
  },
];

export default async function AdminDashboardPage() {
  const data = await loadDashboard();
  const fmt = (n: number | null) => (n === null ? '-' : String(n));

  return (
    <div
      style={{
        flex: 1,
        background: ADMIN_COLORS.pageBg,
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: 40,
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Dashboard"
          description="Your firm at a glance: inbound leads, content health, and quick actions to keep the site current."
          actions={
            <Link
              href="/admin/contact-submissions"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                background: ADMIN_COLORS.primary,
                color: '#FFFFFF',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Inbox size={15} />
              Open Leads Inbox
            </Link>
          }
        />

        {/* KPI grid */}
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          }}
        >
          <StatCard
            label="New Leads"
            value={fmt(data.newLeads)}
            hint={
              data.newLeads && data.newLeads > 0
                ? 'Awaiting first response'
                : 'All caught up'
            }
            Icon={Inbox}
            accent
            href="/admin/contact-submissions"
          />
          <StatCard
            label="Leads This Month"
            value={fmt(data.leadsThisMonth)}
            hint="Since the 1st"
            Icon={TrendingUp}
            href="/admin/contact-submissions"
          />
          <StatCard
            label="Total Leads"
            value={fmt(data.totalLeads)}
            hint="All time"
            Icon={Users}
            href="/admin/contact-submissions"
          />
          <StatCard
            label="Services"
            value={fmt(data.publishedServices)}
            hint="Published service lines"
            Icon={FolderKanban}
            href="/admin/services"
          />
          <StatCard
            label="CMS Pages"
            value={fmt(data.totalPages)}
            hint="Managed pages"
            Icon={FileText}
            href="/admin/pages"
          />
          <StatCard
            label="Page Sections"
            value={fmt(data.totalSections)}
            hint="Across all pages"
            Icon={LayoutTemplate}
            href="/admin/pages"
          />
        </div>

        {/* Recent inquiries + quick actions */}
        <section
          style={{
            marginTop: 28,
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
            alignItems: 'start',
          }}
        >
          {/* Recent inquiries */}
          <div
            style={{
              background: '#FFFFFF',
              border: `1px solid ${ADMIN_COLORS.border}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                borderBottom: `1px solid ${ADMIN_COLORS.border}`,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: ADMIN_COLORS.textHeading,
                  }}
                >
                  Recent Inquiries
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                  Latest submissions from the contact form
                </p>
              </div>
              <Link
                href="/admin/contact-submissions"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: ADMIN_COLORS.primary,
                  textDecoration: 'none',
                }}
              >
                View all
                <ArrowUpRight size={14} />
              </Link>
            </div>

            {data.recentLeads.length === 0 ? (
              <div
                style={{
                  padding: '44px 22px',
                  textAlign: 'center',
                  color: ADMIN_COLORS.textMuted,
                }}
              >
                <Sparkles
                  size={22}
                  style={{ color: ADMIN_COLORS.textMicro, marginBottom: 8 }}
                />
                <p style={{ margin: 0, fontSize: 13 }}>
                  No inquiries yet. New contact-form submissions will appear here.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: ADMIN_COLORS.altBg }}>
                    <th style={th}>Name</th>
                    <th style={th}>Service</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td style={td}>
                        <Link
                          href="/admin/contact-submissions"
                          style={{
                            color: ADMIN_COLORS.textHeading,
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          {lead.name || 'Unknown'}
                        </Link>
                        <div style={{ fontSize: 11, color: ADMIN_COLORS.textMuted }}>
                          {lead.email || ''}
                        </div>
                      </td>
                      <td style={td}>{lead.service_interest || 'Not specified'}</td>
                      <td style={td}>
                        <span style={adminBadge(leadStatusTone(lead.status))}>
                          {lead.status || 'new'}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: ADMIN_COLORS.textMuted }}>
                        {formatRelative(lead.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick actions */}
          <div
            style={{
              background: '#FFFFFF',
              border: `1px solid ${ADMIN_COLORS.border}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${ADMIN_COLORS.border}` }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  color: ADMIN_COLORS.textHeading,
                }}
              >
                Quick Actions
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                Jump straight to the most-used editors
              </p>
            </div>
            <div style={{ padding: 10 }}>
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.Icon;
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 12px',
                      borderRadius: 9,
                      textDecoration: 'none',
                      color: ADMIN_COLORS.textHeading,
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        flexShrink: 0,
                        borderRadius: 9,
                        background: '#EAF1F9',
                        color: ADMIN_COLORS.primary,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={16} />
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          color: ADMIN_COLORS.textHeading,
                        }}
                      >
                        {a.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 11, color: ADMIN_COLORS.textMuted }}>
                        {a.desc}
                      </span>
                    </span>
                    <ArrowUpRight size={15} style={{ color: ADMIN_COLORS.textMicro, flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Collections */}
        <h2
          style={{
            margin: '32px 2px 14px',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMuted,
          }}
        >
          Collections
        </h2>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          }}
        >
          <StatCard
            label="Case Studies"
            value={fmt(data.publishedCaseStudies)}
            hint="Published"
            Icon={FolderKanban}
            href="/admin/case-studies"
          />
          <StatCard
            label="Insights"
            value={fmt(data.publishedInsights)}
            hint="Published articles"
            Icon={FileText}
            href="/admin/articles"
          />
          <StatCard
            label="Testimonials"
            value={fmt(data.approvedTestimonials)}
            hint="Approved"
            Icon={Sparkles}
            href="/admin/testimonials"
          />
          <StatCard
            label="Team & Advisors"
            value={fmt(data.teamMembers)}
            hint="Visible profiles"
            Icon={Users}
            href="/admin/team"
          />
        </div>

        <p style={{ margin: '24px 2px 0', fontSize: 12, color: ADMIN_COLORS.textMicro }}>
          Last content update: {formatDate(data.lastUpdatedIso)}
        </p>
      </div>
    </div>
  );
}

const th = {
  padding: '11px 16px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: ADMIN_COLORS.textMuted,
  textAlign: 'left' as const,
  borderBottom: `1px solid ${ADMIN_COLORS.border}`,
};

const td = {
  padding: '12px 16px',
  fontSize: 13,
  color: ADMIN_COLORS.textBody,
  borderBottom: `1px solid ${ADMIN_COLORS.borderSoft}`,
  verticalAlign: 'top' as const,
};
