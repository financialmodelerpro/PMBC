type Step = { number: string; title: string; description: string };

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickSteps(c: Record<string, unknown>): { intro: string; heading: string; steps: Step[] } {
  const intro = s(c.intro);
  const heading = s(c.heading);
  const raw = Array.isArray(c.steps) ? (c.steps as unknown[]) : [];
  const steps: Step[] = raw
    .map((row, idx) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const title = s(o.title);
      const description = s(o.description);
      const number = s(o.number) || String(idx + 1).padStart(2, '0');
      if (!title && !description) return null;
      return { number, title, description };
    })
    .filter((s): s is Step => s !== null);
  return { intro, heading, steps };
}

export function ProcessSteps({ content }: { content: Record<string, unknown> }) {
  const { intro, heading, steps } = pickSteps(content ?? {});
  if (steps.length === 0 && !heading && !intro) return null;

  return (
    <section className="bg-[#F7F9FC] px-6 py-20 lg:py-24">
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

        {steps.length > 0 && (
          <ol className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, i) => (
              <li key={i} className="relative">
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-5 left-12 hidden h-px w-full -translate-y-1/2 bg-[#D4A93A]/40 lg:block"
                  />
                )}
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D4A93A] bg-white text-sm font-semibold text-[#1B3A5F]">
                    {step.number}
                  </div>
                  {step.title && (
                    <h3 className="mt-4 font-serif text-xl font-semibold tracking-tight text-[#0F1B2D]">
                      {step.title}
                    </h3>
                  )}
                  {step.description && (
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      {step.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
