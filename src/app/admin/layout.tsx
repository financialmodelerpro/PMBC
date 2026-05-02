import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/config';
import { AdminSidebarNav } from '@/components/admin/AdminSidebar';
import { AdminMobileNav } from '@/components/admin/AdminMobileNav';
import { LogoutButton } from '@/components/admin/LogoutButton';

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
  const isLoginRoute = pathname === '/admin/login' || pathname.startsWith('/admin/login?');

  if (isLoginRoute) {
    return <>{children}</>;
  }

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    redirect('/admin/login');
  }

  const adminName = session.user.name || session.user.email;

  return (
    <div className="flex min-h-screen bg-[#F7F9FC] text-[#0F1B2D]">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#0F2540] text-white lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[10px] tracking-[0.22em] uppercase text-[#E8EEF5]/60">
            PaceMakers
          </p>
          <p className="mt-1 text-sm font-medium tracking-tight">Admin Console</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminSidebarNav />
        </div>
        <div className="border-t border-white/10 px-5 py-4 text-[11px] text-[#E8EEF5]/50">
          v1 · Internal use only
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 lg:px-8">
          <AdminMobileNav adminName={adminName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#0F1B2D]">
              {adminName}
            </p>
            <p className="truncate text-[11px] text-neutral-500">
              {session.user.email}
            </p>
          </div>
          <LogoutButton />
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
