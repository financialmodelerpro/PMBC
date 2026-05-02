'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/admin/login' })}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0F2540] transition hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
