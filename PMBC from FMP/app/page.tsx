/**
 * The public home page.
 *
 * Deliberately a placeholder. The admin writes page_sections rows; rendering
 * them is the next piece of work and is intentionally left to you so the
 * PaceMakers front end is not inherited from FMP's design.
 *
 * The contract: read page_sections where page_slug = 'home', ordered by
 * display_order, and switch on section_type.
 *
 * No em dashes in this file.
 */
import Link from 'next/link';

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      fontFamily: "'Inter', system-ui, sans-serif", background: '#F4F7FC', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 34 }}>🏛️</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0D2E5A', margin: 0 }}>
        PaceMakers Business Consultants
      </h1>
      <p style={{ fontSize: 14, color: '#5A6675', maxWidth: 520, margin: 0, lineHeight: 1.6 }}>
        The public site has not been built yet. The content management system behind it is
        ready, so you can start entering content now and design the front end afterwards.
      </p>
      <Link href="/admin/login" style={{
        marginTop: 8, padding: '10px 20px', borderRadius: 7, background: '#1B4F8A',
        color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700,
      }}>
        Open the admin
      </Link>
    </main>
  );
}
