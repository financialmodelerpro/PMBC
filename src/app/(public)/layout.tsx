import { NavbarServer } from '@/components/layout/NavbarServer';
import { FooterServer } from '@/components/layout/FooterServer';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--pmbc-surface)] text-[color:var(--pmbc-text)]">
      {/* JSON-LD outside <head> is valid per schema.org guidance — Google
          parses it from anywhere in the document. */}
      <OrganizationJsonLd />
      <NavbarServer />
      <main className="flex-1">{children}</main>
      <FooterServer />
    </div>
  );
}
