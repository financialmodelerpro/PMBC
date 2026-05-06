import { getSectionMeta } from '@/lib/cms/sectionTypes';
import { SectionContainer } from '../SectionContainer';
import type { PmbcVariant } from '@/lib/public/tokens';

export function SectionPlaceholder({
  sectionType,
  variant = 'white',
}: {
  sectionType: string;
  variant?: PmbcVariant;
}) {
  const meta = getSectionMeta(sectionType);
  return (
    <SectionContainer variant={variant} size="compact">
      <div
        className="mx-auto max-w-[680px] p-7 text-center"
        style={{
          border: '1px dashed #D4A93A',
          background: 'rgba(212, 169, 58, 0.04)',
        }}
      >
        <p
          className="text-[10px] font-semibold uppercase"
          style={{ letterSpacing: '0.18em', color: '#B89530' }}
        >
          {meta?.label ?? sectionType}
        </p>
        <p className="mt-2 text-[14px] text-[#52606B]">
          Renderer for <code className="font-mono text-[12px]">{sectionType}</code> is not configured.
        </p>
      </div>
    </SectionContainer>
  );
}
