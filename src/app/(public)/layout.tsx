import { NavbarServer } from '@/components/layout/NavbarServer';
import { FooterServer } from '@/components/layout/FooterServer';

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--pmbc-surface)] text-[color:var(--pmbc-text)]">
      <NavbarServer />
      <main className="flex-1">{children}</main>
      <FooterServer />
    </div>
  );
}
