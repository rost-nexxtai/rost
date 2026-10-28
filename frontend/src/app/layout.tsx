import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import './globals.css';

// Self-hosted at build time, so the demo works offline. latin-ext covers ă â î ș ț.
const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], weight: ['600', '700', '800'], variable: '--font-display' });
const body = DM_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Rost: banii tăi, pe înțelesul tău',
  description: 'Află ce să faci cu banii tăi, pe cifrele tale: lecții scurte, opțiuni comparate neutru și știrile care îți mișcă banii.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F7F5F0' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
