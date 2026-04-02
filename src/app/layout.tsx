import type { Metadata } from 'next';
import '@/styles/globals.css';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { ConfigProvider } from '@/components/providers/ConfigProvider';
import type { MemberIdentity } from '@/components/providers/ConfigProvider';
import { getSeasonLeagues, getActiveSeasonYear } from '@/lib/config';
import { getMemberScope } from '@/lib/member-scope';
import { ORG_NAME, ORG_SHORT_NAME } from '@/config/constants';

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
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary antialiased">
        <ConfigProvider leagues={leagues} seasonYear={seasonYear} member={member}>
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
