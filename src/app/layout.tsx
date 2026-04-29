import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PaceMakers Business Consultants',
  description:
    'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
