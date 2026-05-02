export function Paragraphs({ content }: { content: Record<string, unknown> }) {
  const html = typeof content?.html === 'string' ? content.html : '';
  if (!html) return null;
  return (
    <section className="px-6 py-16 lg:py-20">
      <div
        className="prose prose-neutral mx-auto max-w-3xl text-[#0F1B2D]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
