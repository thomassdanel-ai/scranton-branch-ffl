import type { Metadata } from 'next';
import { Bebas_Neue, Geist, Geist_Mono, Fraunces } from 'next/font/google';
import '@/styles/globals.css';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { ConfigProvider } from '@/components/providers/ConfigProvider';
import type { MemberIdentity } from '@/components/providers/ConfigProvider';
import { getSeasonLeagues, getActiveSeasonYear } from '@/lib/config';
import { getMemberScope } from '@/lib/member-scope';
import { ORG_NAME, ORG_SHORT_NAME } from '@/config/constants';

const bebas = Bebas_Neue({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400'],
});

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://scranton-branch-ffl.vercel.app';

export const metadata: Metadata = {
  title: {
    default: ORG_NAME,
    template: `%s | ${ORG_SHORT_NAME}`,
  },
  description: `The official hub for the ${ORG_NAME} — scores, standings, power rankings, and more.`,
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    siteName: ORG_SHORT_NAME,
    title: ORG_NAME,
    description: `Cross-league fantasy football hub — power rankings, live scores, championship bracket, and trash talk.`,
    url: siteUrl,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: ORG_NAME,
    description: `Cross-league fantasy football hub — power rankings, live scores, championship bracket, and trash talk.`,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [leagues, seasonYear, memberScope] = await Promise.all([
    getSeasonLeagues(),
    getActiveSeasonYear(),
    getMemberScope().catch(() => null),
  ]);

  const member: MemberIdentity = memberScope
    ? {
        memberId: memberScope.memberId,
        memberName: memberScope.memberName,
        leagueId: memberScope.leagueId,
        leagueName: memberScope.leagueName,
      }
    : null;

  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${bebas.variable} ${geist.variable} ${geistMono.variable} ${fraunces.variable}`}
    >
      <body className="min-h-screen flex flex-col antialiased font-sans">
        <ConfigProvider leagues={leagues} seasonYear={seasonYear} member={member}>
          <Nav />
          <main className="flex-1 w-full">
            {children}
          </main>
          <Footer />
        </ConfigProvider>
      </body>
    </html>
  );
}
