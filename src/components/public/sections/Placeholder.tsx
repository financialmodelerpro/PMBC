import { getSectionMeta } from '@/lib/cms/sectionTypes';

export function SectionPlaceholder({ sectionType }: { sectionType: string }) {
  const meta = getSectionMeta(sectionType);
  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
        <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-neutral-500">
          {meta?.label ?? sectionType}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Renderer for <code className="font-mono text-[12px]">{sectionType}</code> is coming in Phase 6.
        </p>
      </div>
    </section>
  );
}
