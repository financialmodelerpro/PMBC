'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Trash2, UploadCloud } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  ADMIN_COLORS,
  adminButtonPrimary,
  adminInput,
  adminPageMain,
} from '@/lib/admin/styles';

const BUCKETS = ['cms-assets', 'article-covers', 'case-study-images', 'team-photos'] as const;
type Bucket = (typeof BUCKETS)[number];

type MediaFile = {
  name: string;
  size: number | null;
  mimetype: string | null;
  created_at: string | null;
  url: string;
};

function formatSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminMediaPage() {
  const [bucket, setBucket] = useState<Bucket>('cms-assets');
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (b: Bucket) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/media?bucket=${b}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setFiles(json.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(bucket);
  }, [bucket, load]);

  const upload = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('bucket', bucket);
        Array.from(list).forEach((f) => form.append('file', f));
        const res = await fetch('/api/admin/media', { method: 'POST', body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        await load(bucket);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [bucket, load],
  );

  const remove = useCallback(
    async (name: string) => {
      if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
      try {
        const res = await fetch('/api/admin/media', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket, name }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Delete failed');
        await load(bucket);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    },
    [bucket, load],
  );

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Media Library"
          description="Upload, browse, and delete images. Copy a public URL to paste into any content field."
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as Bucket)}
            style={{ ...adminInput, width: 'auto', minWidth: 200 }}
          >
            {BUCKETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={adminButtonPrimary}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            {uploading ? 'Uploading…' : 'Upload files'}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => upload(e.target.files)}
          />
          {error && <span style={{ fontSize: 12, color: ADMIN_COLORS.danger }}>{error}</span>}
        </div>

        <div
          style={{
            background: '#fff',
            border: `1px solid ${ADMIN_COLORS.border}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: 44, textAlign: 'center', color: ADMIN_COLORS.textMuted, fontSize: 13 }}>
              No files in this bucket yet. Upload one to get started.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 14,
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              }}
            >
              {files.map((f) => (
                <div
                  key={f.name}
                  style={{
                    border: `1px solid ${ADMIN_COLORS.border}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ height: 120, background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {f.mimetype === 'application/pdf' ? (
                      <span style={{ fontSize: 13, color: ADMIN_COLORS.textMuted }}>PDF</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p
                      title={f.name}
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        color: ADMIN_COLORS.textHeading,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {f.name}
                    </p>
                    <p style={{ margin: '2px 0 8px', fontSize: 11, color: ADMIN_COLORS.textMuted }}>
                      {formatSize(f.size)}
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => copy(f.url)}
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          padding: '6px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          border: `1px solid ${ADMIN_COLORS.border}`,
                          borderRadius: 6,
                          background: '#fff',
                          color: ADMIN_COLORS.primary,
                          cursor: 'pointer',
                        }}
                      >
                        {copied === f.url ? <Check size={12} /> : <Copy size={12} />}
                        {copied === f.url ? 'Copied' : 'Copy URL'}
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        onClick={() => remove(f.name)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 30,
                          border: `1px solid ${ADMIN_COLORS.border}`,
                          borderRadius: 6,
                          background: '#fff',
                          color: ADMIN_COLORS.danger,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
