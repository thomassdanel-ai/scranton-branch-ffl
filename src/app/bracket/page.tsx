import { loadBracket, getQualifierCount } from '@/lib/bracket/engine';
import { LEAGUE_CONFIG } from '@/config/leagues';
import BracketView from '@/components/bracket/BracketView';

export const metadata = {
  title: 'Championship Bracket | Scranton Branch FFL',
  description: 'Cross-league championship bracket.',
};

export const revalidate = 300; // 5 min ISR

export default async function BracketPage() {
  const bracket = await loadBracket();
  const qualifiers = getQualifierCount();

  if (!bracket) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Championship Bracket</h1>
          <p className="text-text-secondary mt-1">
            Cross-league playoff bracket — top {LEAGUE_CONFIG.championship.qualifiersPerLeague} from each league qualify.
          </p>
        </div>

        <div className="glass-card p-12 text-center space-y-4">
          <div className="text-5xl">🏆</div>
          <h2 className="text-xl font-bold text-white">Bracket Not Set Up Yet</h2>
          <p className="text-text-secondary max-w-md mx-auto">
            The commissioner will seed the {qualifiers}-team championship bracket
            once the regular season wraps up. Check back when playoffs begin!
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {LEAGUE_CONFIG.leagues.map((league) => (
              <div
                key={league.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary"
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: league.color }} />
                <span className="text-sm text-text-secondary">
                  Top {LEAGUE_CONFIG.championship.qualifiersPerLeague} from {league.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Championship Bracket</h1>
        <p className="text-text-secondary mt-1">
          {bracket.seasonYear} Season — {bracket.teams.length}-team cross-league playoff
        </p>
      </div>

      <BracketView bracket={bracket} />
    </div>
  );
}
