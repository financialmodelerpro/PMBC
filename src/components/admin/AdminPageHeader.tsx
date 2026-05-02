export function AdminPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#1B3A5F]">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0F1B2D]">
        {title}
      </h1>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>
      )}
    </header>
  );
}
