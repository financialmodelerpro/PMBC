import { resolveSectorIcon } from '@/lib/cms/sectorIcons';

type Sector = { icon_name: string; title: string; description: string };

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickSectors(c: Record<string, unknown>): { intro: string; heading: string; sectors: Sector[] } {
  const intro = s(c.intro);
  const heading = s(c.heading);
  const raw =
    (Array.isArray(c.sectors) && (c.sectors as unknown[])) ||
    (Array.isArray(c.items) && (c.items as unknown[])) ||
    [];
  const sectors: Sector[] = raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const title = s(o.title);
      const description = s(o.description);
      const icon_name = s(o.icon_name);
      if (!title && !description) return null;
      return { icon_name, title, description };
    })
    .filter((s): s is Sector => s !== null);
  return { intro, heading, sectors };
}

export function SectorGrid({ content }: { content: Record<string, unknown> }) {
  const { intro, heading, sectors } = pickSectors(content ?? {});
  if (sectors.length === 0 && !heading && !intro) return null;

  return (
    <section className="px-6 py-20 lg:py-24">
      <div className="mx-auto max-w-6xl">
        {(heading || intro) && (
          <div className="mx-auto max-w-3xl text-center">
            {heading && (
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#0F1B2D] sm:text-4xl">
                {heading}
              </h2>
            )}
            {intro && (
              <p className="mt-4 text-base text-neutral-600 sm:text-lg">{intro}</p>
            )}
          </div>
        )}
        {sectors.length > 0 && (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((sector, i) => {
              const Icon = resolveSectorIcon(sector.icon_name);
              return (
                <div
                  key={i}
                  className="rounded-lg border border-neutral-200 bg-white p-6 transition hover:border-[#1B3A5F] hover:shadow-[0_2px_10px_rgba(15,27,45,0.06)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1B3A5F]/5 text-[#1B3A5F]">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  {sector.title && (
                    <h3 className="mt-4 text-base font-semibold tracking-tight text-[#0F1B2D]">
                      {sector.title}
                    </h3>
                  )}
                  {sector.description && (
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      {sector.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
