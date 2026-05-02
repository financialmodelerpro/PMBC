import { Suspense } from 'react';
import type { Metadata } from 'next';

import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Admin sign in — PaceMakers Business Consultants',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#1B3A5F]">
            PaceMakers Business Consultants
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F1B2D]">
            Admin sign in
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Authorized personnel only.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-7 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[11px] tracking-wider uppercase text-neutral-400">
          Advisory from Structure to Exit
        </p>
      </div>
    </main>
  );
}
