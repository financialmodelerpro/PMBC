type Stat = { value: string; label: string };

function pickStats(content: Record<string, unknown>): { intro: string; stats: Stat[] } {
  const intro = typeof content?.intro === 'string' ? content.intro : '';
  const raw = Array.isArray(content?.stats) ? (content.stats as unknown[]) : [];
  const stats: Stat[] = raw
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const o = s as Record<string, unknown>;
      const value = typeof o.value === 'string' ? o.value : '';
      const label = typeof o.label === 'string' ? o.label : '';
      if (!value && !label) return null;
      return { value, label };
    })
    .filter((s): s is Stat => s !== null);
  return { intro, stats };
}

export function StatsBlock({ content }: { content: Record<string, unknown> }) {
  const { intro, stats } = pickStats(content ?? {});
  if (stats.length === 0 && !intro) return null;

  return (
    <section className="bg-[#F7F9FC] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        {intro && (
          <p className="mx-auto max-w-2xl text-center text-base text-neutral-600">{intro}</p>
        )}
        {stats.length > 0 && (
          <dl
            className={
              'mt-10 grid gap-8 ' +
              (stats.length >= 4
                ? 'grid-cols-2 lg:grid-cols-4'
                : stats.length === 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : stats.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1')
            }
          >
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <dt className="order-2 mt-2 text-[11px] font-medium tracking-[0.18em] uppercase text-neutral-500">
                  {s.label}
                </dt>
                <dd className="text-3xl font-semibold tracking-tight text-[#0F1B2D] sm:text-4xl">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
