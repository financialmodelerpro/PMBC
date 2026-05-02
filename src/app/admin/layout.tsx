import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/config';
import { CmsAdminNav } from '@/components/admin/CmsAdminNav';

export const dynamic = 'force-dynamic';

function getCurrentPathname(headerList: Headers): string {
  return (
    headerList.get('x-invoke-path') ||
    headerList.get('x-pathname') ||
    headerList.get('next-url') ||
    ''
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = getCurrentPathname(headerList);
  const isLoginRoute =
    pathname === '/admin/login' || pathname.startsWith('/admin/login?');

  if (isLoginRoute) {
    return <>{children}</>;
  }

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    redirect('/admin/login');
  }

  const adminName = session.user.name || session.user.email || 'Admin';
  const adminEmail = session.user.email || undefined;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#F4F7FC',
        color: '#0F1B2D',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      }}
    >
      <CmsAdminNav adminName={adminName} adminEmail={adminEmail} />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>
    </div>
  );
}
