'use client';

import { MediaField } from '@/components/admin/MediaField';
import { adminFieldHint, adminInput, adminLabel, adminTextarea } from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function FounderHeroEditor({ content, onChange }: SectionEditorProps) {
  const set = (key: string, value: unknown) => onChange({ ...content, [key]: value });

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <MediaField
          content={content}
          urlKey="photo_url"
          bucket="team-photos"
          label="Portrait"
          onChange={(patch) => onChange({ ...content, ...patch })}
        />
        <p style={adminFieldHint}>
          Leave empty to show the gold-framed monogram fallback. Portrait crops to a 4:5 frame.
        </p>
      </div>

      <div>
        <label style={adminLabel}>Eyebrow</label>
        <input
          type="text"
          value={s(content.eyebrow)}
          placeholder="Founder"
          onChange={(e) => set('eyebrow', e.target.value)}
          style={adminInput}
        />
      </div>

      <div>
        <label style={adminLabel}>Name</label>
        <input
          type="text"
          value={s(content.name)}
          placeholder="Ahmad Din"
          onChange={(e) => set('name', e.target.value)}
          style={adminInput}
        />
        <p style={adminFieldHint}>Renders as the page h1.</p>
      </div>

      <div>
        <label style={adminLabel}>Title, first line</label>
        <input
          type="text"
          value={s(content.title_primary)}
          placeholder="Corporate Finance and Transaction Advisory Specialist"
          onChange={(e) => set('title_primary', e.target.value)}
          style={adminInput}
        />
      </div>

      <div>
        <label style={adminLabel}>Title, second line (gold)</label>
        <input
          type="text"
          value={s(content.title_accent)}
          placeholder="Financial Modeling Expert"
          onChange={(e) => set('title_accent', e.target.value)}
          style={adminInput}
        />
      </div>

      <div>
        <label style={adminLabel}>Credentials line</label>
        <input
          type="text"
          value={s(content.credentials_line)}
          placeholder="ACCA | FMVA | 12+ Years Experience"
          onChange={(e) => set('credentials_line', e.target.value)}
          style={adminInput}
        />
      </div>

      <div>
        <label style={adminLabel}>Intro paragraph</label>
        <textarea
          value={s(content.intro)}
          onChange={(e) => set('intro', e.target.value)}
          style={adminTextarea}
        />
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label style={adminLabel}>Primary CTA label</label>
          <input
            type="text"
            value={s(content.cta_primary_label)}
            placeholder="Connect on LinkedIn"
            onChange={(e) => set('cta_primary_label', e.target.value)}
            style={adminInput}
          />
        </div>
        <div>
          <label style={adminLabel}>Primary CTA link</label>
          <input
            type="text"
            value={s(content.cta_primary_href)}
            placeholder="https://www.linkedin.com/in/..."
            onChange={(e) => set('cta_primary_href', e.target.value)}
            style={adminInput}
          />
        </div>
        <div>
          <label style={adminLabel}>Secondary CTA label</label>
          <input
            type="text"
            value={s(content.cta_secondary_label)}
            placeholder="Book a Meeting"
            onChange={(e) => set('cta_secondary_label', e.target.value)}
            style={adminInput}
          />
        </div>
        <div>
          <label style={adminLabel}>Secondary CTA link</label>
          <input
            type="text"
            value={s(content.cta_secondary_href)}
            placeholder="https://outlook.office.com/bookwithme/..."
            onChange={(e) => set('cta_secondary_href', e.target.value)}
            style={adminInput}
          />
        </div>
      </div>
      <p style={adminFieldHint}>
        A CTA renders only when it has both a label and a link. An http link opens in a new tab
        and shows an external-link icon.
      </p>
    </div>
  );
}
