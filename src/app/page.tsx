import { LEAGUE_CONFIG } from '@/config/leagues';

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-12">
        <p className="text-accent-gold text-sm font-semibold uppercase tracking-widest mb-3">
          {LEAGUE_CONFIG.currentSeason} Season
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
          {LEAGUE_CONFIG.name}
        </h1>
        <p className="text-text-secondary text-lg max-w-xl mx-auto">
          Your cross-league fantasy hub — scores, power rankings, and trash talk, all in one place.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          {LEAGUE_CONFIG.leagues.map((league) => (
            <a
              key={league.id}
              href={`/leagues/${league.id}`}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                backgroundColor: `${league.color}22`,
                color: league.color,
                border: `1px solid ${league.color}44`,
              }}
            >
              {league.name} League
            </a>
          ))}
        </div>
      </section>

      {/* Coming soon placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h2 className="font-bold text-white mb-2">Live Scores</h2>
          <p className="text-text-muted text-sm">Matchup scores will appear here during the season.</p>
        </div>
        <div className="glass-card p-6">
          <h2 className="font-bold text-white mb-2">Power Rankings</h2>
          <p className="text-text-muted text-sm">Cross-league power rankings coming in Phase 2.</p>
        </div>
        <div className="glass-card p-6">
          <h2 className="font-bold text-white mb-2">Activity Feed</h2>
          <p className="text-text-muted text-sm">Trades, waiver pickups, and announcements will appear here.</p>
        </div>
        <div className="glass-card p-6">
          <h2 className="font-bold text-white mb-2">Championship Bracket</h2>
          <p className="text-text-muted text-sm">Cross-league playoff bracket coming in Phase 3.</p>
        </div>
      </div>
    </div>
  );
}
