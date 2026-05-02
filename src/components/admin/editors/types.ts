export type SectionEditorProps = {
  content: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};
