import type { Metadata } from 'next';
import '@/styles/globals.css';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { ConfigProvider } from '@/components/providers/ConfigProvider';
import { getSeasonLeagues } from '@/lib/config';
import { ORG_NAME, ORG_SHORT_NAME } from '@/config/constants';

export const metadata: Metadata = {
  title: {
    default: ORG_NAME,
    template: `%s | ${ORG_SHORT_NAME}`,
  },
  description: `The official hub for the ${ORG_NAME} — scores, standings, power rankings, and more.`,
  openGraph: {
    type: 'website',
    siteName: ORG_SHORT_NAME,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const leagues = await getSeasonLeagues();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary antialiased">
        <ConfigProvider leagues={leagues}>
          <Nav />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
            {children}
          </main>
          <Footer />
        </ConfigProvider>
      </body>
    </html>
  );
}
