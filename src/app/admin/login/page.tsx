import { Suspense } from 'react';
import type { Metadata } from 'next';

import { ADMIN_COLORS } from '@/lib/admin/styles';

import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Admin sign in | PaceMakers Business Consultants',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: ADMIN_COLORS.pageBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
        color: ADMIN_COLORS.textHeading,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: ADMIN_COLORS.primary,
            }}
          >
            PaceMakers Business Consultants
          </p>
          <h1
            style={{
              margin: '12px 0 0',
              fontSize: 24,
              fontWeight: 800,
              color: ADMIN_COLORS.primaryDeep,
              letterSpacing: '-0.01em',
            }}
          >
            Admin sign in
          </h1>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              color: ADMIN_COLORS.textMuted,
            }}
          >
            Authorized personnel only.
          </p>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: `1px solid ${ADMIN_COLORS.border}`,
            borderRadius: 12,
            padding: 28,
            boxShadow: '0 1px 2px rgba(15,27,45,0.04)',
          }}
        >
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p
          style={{
            marginTop: 24,
            textAlign: 'center',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: ADMIN_COLORS.textMicro,
          }}
        >
          Advisory from Structure to Exit
        </p>
      </div>
    </main>
  );
}
