'use client';

import type { SectionEditorProps } from './types';

const inputCls =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function HeroEditor({ content, onChange }: SectionEditorProps) {
  // Backwards-compat: read legacy `badge` if `badge_text` is missing.
  const badge_text = s(content.badge_text) || s(content.badge);
  const headline = s(content.headline);
  const subtitle = s(content.subtitle);
  const cta_label = s(content.cta_label);
  const cta_href = s(content.cta_href);
  const cta_secondary_label = s(content.cta_secondary_label);
  const cta_secondary_href = s(content.cta_secondary_href);
  const background_style = content.background_style === 'dark' ? 'dark' : 'light';

  const update = (patch: Record<string, unknown>) => {
    const { badge: _legacy, ...rest } = content;
    void _legacy;
    onChange({
      ...rest,
      badge_text,
      headline,
      subtitle,
      cta_label,
      cta_href,
      cta_secondary_label,
      cta_secondary_href,
      background_style,
      ...patch,
    });
  };

  return (
    <div className="space-y-5">
      <Field label="Badge text" hint="Small uppercase eyebrow above the headline">
        <input
          type="text"
          value={badge_text}
          onChange={(e) => update({ badge_text: e.target.value })}
          className={inputCls}
        />
      </Field>

      <Field label="Headline">
        <input
          type="text"
          value={headline}
          onChange={(e) => update({ headline: e.target.value })}
          className={inputCls}
        />
      </Field>

      <Field label="Subtitle">
        <textarea
          value={subtitle}
          onChange={(e) => update({ subtitle: e.target.value })}
          rows={3}
          className={inputCls + ' resize-y'}
        />
      </Field>

      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-medium text-[#0F2540]">Primary CTA</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label">
            <input
              type="text"
              value={cta_label}
              onChange={(e) => update({ cta_label: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Link">
            <input
              type="text"
              value={cta_href}
              onChange={(e) => update({ cta_href: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-medium text-[#0F2540]">Secondary CTA (optional)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label">
            <input
              type="text"
              value={cta_secondary_label}
              onChange={(e) => update({ cta_secondary_label: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Link">
            <input
              type="text"
              value={cta_secondary_href}
              onChange={(e) => update({ cta_secondary_href: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
      </fieldset>

      <Field label="Background style">
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((option) => {
            const active = background_style === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => update({ background_style: option })}
                className={
                  'rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition ' +
                  (active
                    ? 'border-[#1B3A5F] bg-[#1B3A5F] text-white'
                    : 'border-neutral-300 bg-white text-[#0F2540] hover:border-[#1B3A5F]')
                }
              >
                {option}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-[#0F2540]">{label}</span>
        {hint && <span className="text-[11px] text-neutral-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
