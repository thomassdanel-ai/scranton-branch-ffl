import type { Metadata } from 'next';
import { Bricolage_Grotesque, Onest, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import AuroraBackground from '@/components/ui/AuroraBackground';
import { ConfigProvider } from '@/components/providers/ConfigProvider';
import type { MemberIdentity } from '@/components/providers/ConfigProvider';
import { getSeasonLeagues, getActiveSeasonYear } from '@/lib/config';
import { getMemberScope } from '@/lib/member-scope';
import { ORG_NAME, ORG_SHORT_NAME } from '@/config/constants';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const onest = Onest({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
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
      className={`dark ${bricolage.variable} ${onest.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary antialiased font-sans">
        <ConfigProvider leagues={leagues} seasonYear={seasonYear} member={member}>
          <Nav />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 relative z-10">
            {children}
          </main>
          <Footer />
        </ConfigProvider>
      </body>
    </html>
  );
}
