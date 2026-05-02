'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

import { AdminSidebarNav } from './AdminSidebar';

export function AdminMobileNav({ adminName }: { adminName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md p-2 text-[#0F2540] hover:bg-neutral-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-[#0F2540]/60"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-72 flex-col bg-[#0F2540] text-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#E8EEF5]/60">
                  PaceMakers
                </p>
                <p className="text-sm font-medium">{adminName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
              <AdminSidebarNav />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
