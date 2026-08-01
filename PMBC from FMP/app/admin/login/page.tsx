'use client';

/**
 * /admin/login - the way in.
 *
 * One shared password, exchanged for a signed HttpOnly cookie. See
 * src/shared/auth/adminAuth.ts for why it fails closed when unconfigured.
 *
 * No em dashes in this file.
 */

import { useState } from 'react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Sign in failed.'); return; }
      window.location.href = '/admin/cms';
    } catch {
      setError('Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0D2E5A', fontFamily: "'Inter', system-ui, sans-serif", padding: 20,
    }}>
      <form onSubmit={submit} style={{
        background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 380,
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 26, marginBottom: 6 }}>🏛️</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0D2E5A', margin: '0 0 4px' }}>PaceMakers Admin</h1>
        <p style={{ fontSize: 13, color: '#5A6675', margin: '0 0 20px' }}>Content management</p>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#5A6675', marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 7,
            border: '1px solid #C7CDD4', marginBottom: 14,
          }}
        />

        {error && (
          <div style={{
            background: '#FDECEC', color: '#B23A3A', border: '1px solid #B23A3A33',
            borderRadius: 7, padding: '9px 12px', fontSize: 13, marginBottom: 14,
          }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 7, border: 'none',
            background: busy || !password ? '#9AA3AD' : '#1B4F8A', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: busy || !password ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
