/**
 * /admin/cms - the admin dashboard, and the landing page after sign in.
 *
 * Deliberately plain: it is a launcher for the seven content tools. The FMP
 * original carried platform stats that have no meaning here.
 *
 * No em dashes in this file.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CmsAdminNav } from '@/src/components/admin/CmsAdminNav';
import { isAdminRequest, adminAuthConfigured } from '@/src/shared/auth/adminAuth';

export const dynamic = 'force-dynamic';

const TOOLS = [
  { href: '/admin/page-builder',   icon: '🧱', name: 'Page Builder',    blurb: 'Build and reorder the sections that make up each page.' },
  { href: '/admin/header-settings', icon: '🔲', name: 'Header Settings', blurb: 'Logo, header copy and brand colours.' },
  { href: '/admin/content',        icon: '📝', name: 'Page Content',    blurb: 'Edit the text blocks used across the site.' },
  { href: '/admin/pages',          icon: '🗂️', name: 'Pages & Nav',     blurb: 'Create pages and arrange the navigation.' },
  { href: '/admin/articles',       icon: '📰', name: 'Articles',        blurb: 'Write, schedule and publish articles.' },
  { href: '/admin/testimonials',   icon: '⭐', name: 'Testimonials',    blurb: 'Client quotes shown on the site.' },
  { href: '/admin/media',          icon: '🖼️', name: 'Media Library',   blurb: 'Upload and reuse images.' },
];

export default async function AdminHome() {
  // Server-side gate. Every API route re-checks independently; this only keeps
  // the shell from rendering to someone who is not signed in.
  if (!await isAdminRequest()) redirect('/admin/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: '#F4F7FC' }}>
      <CmsAdminNav active="/admin/cms" />
      <main style={{ flex: 1, padding: 40, overflowY: 'auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0D2E5A', margin: '0 0 6px' }}>PaceMakers Content</h1>
        <p style={{ fontSize: 13, color: '#5A6675', margin: '0 0 26px' }}>
          Everything that makes up the public site. Changes are live as soon as you save.
        </p>

        {!adminAuthConfigured() && (
          <div style={{ background: '#FDECEC', border: '1px solid #B23A3A33', borderRadius: 10, padding: 16, marginBottom: 22 }}>
            <strong style={{ color: '#B23A3A' }}>Admin access is not configured.</strong>
            <p style={{ fontSize: 13, color: '#5A6675', margin: '6px 0 0' }}>
              Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET. Until then every admin route denies.
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                padding: 18, height: '100%',
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{t.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0D2E5A', marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: '#5A6675', lineHeight: 1.5 }}>{t.blurb}</div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
