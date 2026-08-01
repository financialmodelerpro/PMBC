'use client';

/**
 * /admin/testimonials
 *
 * Rewritten rather than copied. The FMP original was built around two sources
 * (manual plus student testimonials) and a Training/Modeling hub tab, neither
 * of which exists on a consultancy site, so a straight copy would have shown
 * tabs that could never be right.
 *
 * No em dashes in this file.
 */

import { useCallback, useEffect, useState } from 'react';
import { CmsAdminNav } from '@/src/components/admin/CmsAdminNav';

interface Testimonial {
  id: string;
  text: string;
  name: string;
  role: string | null;
  company: string | null;
  rating: number | null;
  is_featured: boolean;
  status: string;
  display_order: number;
}

const EMPTY = { text: '', name: '', role: '', company: '', rating: 5, display_order: 0 };

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18, marginBottom: 16 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #C7CDD4', borderRadius: 6, marginBottom: 10 };
const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#5A6675', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 };

export default function TestimonialsAdmin() {
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const flash = (text: string, bad = false) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/testimonials', { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const json = await res.json();
      setRows(json.testimonials ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!draft.text.trim() || !draft.name.trim()) { flash('Quote and name are required.', true); return; }
    setSaving(true);
    const res = await fetch('/api/admin/testimonials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    });
    setSaving(false);
    if (!res.ok) { flash((await res.json()).error ?? 'Save failed.', true); return; }
    setDraft({ ...EMPTY });
    flash('Testimonial added.');
    void load();
  };

  const patch = async (id: string, changes: Partial<Testimonial>) => {
    const res = await fetch('/api/admin/testimonials', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...changes }),
    });
    if (!res.ok) { flash('Update failed.', true); return; }
    void load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/testimonials?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) { flash('Delete failed.', true); return; }
    flash('Deleted.');
    void load();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: '#F4F7FC' }}>
      <CmsAdminNav active="/admin/testimonials" />
      <main style={{ flex: 1, padding: 40, overflowY: 'auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0D2E5A', margin: '0 0 6px' }}>Testimonials</h1>
        <p style={{ fontSize: 13, color: '#5A6675', margin: '0 0 22px' }}>Client quotes shown on the public site.</p>

        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
            background: msg.bad ? '#FDECEC' : '#E7F5EC', color: msg.bad ? '#B23A3A' : '#2E7D52',
          }}>{msg.text}</div>
        )}

        <div style={{ ...card, maxWidth: 620 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0D2E5A', margin: '0 0 14px' }}>Add a testimonial</h2>
          <label style={label}>Quote</label>
          <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            rows={3} style={{ ...input, resize: 'vertical' }} placeholder="They transformed how we plan." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Name</label>
              <input style={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label style={label}>Title</label>
              <input style={input} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Finance Director" />
            </div>
            <div>
              <label style={label}>Company</label>
              <input style={input} value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
            </div>
            <div>
              <label style={label}>Rating (1 to 5)</label>
              <input style={input} type="number" min={1} max={5} value={draft.rating}
                onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })} />
            </div>
          </div>
          <button onClick={add} disabled={saving}
            style={{ padding: '9px 18px', borderRadius: 7, border: 'none', background: '#1B4F8A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Add testimonial'}
          </button>
        </div>

        {loading ? <p style={{ color: '#5A6675' }}>Loading...</p> : rows.length === 0 ? (
          <div style={card}>
            <strong style={{ color: '#0D2E5A' }}>No testimonials yet.</strong>
            <p style={{ fontSize: 13, color: '#5A6675', margin: '6px 0 0' }}>Add your first one above.</p>
          </div>
        ) : rows.map((t) => (
          <div key={t.id} style={card}>
            <p style={{ fontSize: 14, color: '#2A3440', margin: '0 0 10px', fontStyle: 'italic' }}>{t.text}</p>
            <div style={{ fontSize: 12.5, color: '#5A6675', marginBottom: 12 }}>
              <strong style={{ color: '#2A3440' }}>{t.name}</strong>
              {t.role ? `, ${t.role}` : ''}{t.company ? `, ${t.company}` : ''}
              {t.rating ? `  ${'*'.repeat(t.rating)}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => patch(t.id, { is_featured: !t.is_featured })}
                style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${t.is_featured ? '#2E7D52' : '#C7CDD4'}`,
                  background: t.is_featured ? '#E7F5EC' : '#F1F3F5', color: t.is_featured ? '#2E7D52' : '#5A6675' }}>
                {t.is_featured ? 'Featured' : 'Not featured'}
              </button>
              <button onClick={() => patch(t.id, { status: t.status === 'approved' ? 'pending' : 'approved' })}
                style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid #C7CDD4', background: '#F1F3F5', color: '#5A6675' }}>
                {t.status === 'approved' ? 'Approved' : 'Pending'}
              </button>
              <button onClick={() => remove(t.id)}
                style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid #B23A3A55', background: '#FDECEC', color: '#B23A3A' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
