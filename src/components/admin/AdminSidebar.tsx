'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  LayoutTemplate,
  Type,
  Palette,
  PanelTop,
  Inbox,
  Mail,
  FileCode2,
  Settings,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  matchExact?: boolean;
};

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, matchExact: true },
  { label: 'Pages', href: '/admin/pages', icon: FileText },
  { label: 'Page Builder', href: '/admin/page-builder', icon: LayoutTemplate },
  { label: 'Content', href: '/admin/content', icon: Type },
  { label: 'Branding', href: '/admin/branding', icon: Palette },
  { label: 'Header Settings', href: '/admin/header-settings', icon: PanelTop },
  { label: 'Contact Submissions', href: '/admin/contact-submissions', icon: Inbox },
  { label: 'Email Branding', href: '/admin/email-branding', icon: Mail },
  { label: 'Email Templates', href: '/admin/email-templates', icon: FileCode2 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.matchExact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ' +
              (active
                ? 'bg-[#1B3A5F] text-white'
                : 'text-[#E8EEF5]/80 hover:bg-white/5 hover:text-white')
            }
          >
            <Icon
              className={
                'h-4 w-4 shrink-0 ' +
                (active ? 'text-white' : 'text-[#E8EEF5]/60 group-hover:text-white')
              }
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
