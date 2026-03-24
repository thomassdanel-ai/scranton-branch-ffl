import type { Metadata } from 'next';
import '@/styles/globals.css';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { LEAGUE_CONFIG } from '@/config/leagues';

export const metadata: Metadata = {
  title: {
    default: LEAGUE_CONFIG.name,
    template: `%s | ${LEAGUE_CONFIG.shortName}`,
  },
  description: `The official hub for the ${LEAGUE_CONFIG.name} — scores, standings, power rankings, and more.`,
  openGraph: {
    type: 'website',
    siteName: LEAGUE_CONFIG.shortName,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary antialiased">
        <Nav />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
