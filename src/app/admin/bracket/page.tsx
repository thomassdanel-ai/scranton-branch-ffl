'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BracketTeam {
  rosterId: number;
  leagueId: string;
  leagueName: string;
  leagueColor: string;
  teamName: string;
  displayName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  pointsFor: number;
  seed: number;
}

interface BracketMatchup {
  id: string;
  round: number;
  position: number;
  team1Seed: number | null;
  team2Seed: number | null;
  team1Score: number | null;
  team2Score: number | null;
  winningSeed: number | null;
  label: string;
}

interface BracketData {
  seasonYear: string;
  teams: BracketTeam[];
  matchups: BracketMatchup[];
  rounds: number;
  status: 'pending' | 'in_progress' | 'complete';
  champion: BracketTeam | null;
}

interface RankedTeam {
  team: {
    rosterId: number;
    teamName: string | null;
    displayName: string;
    avatar: string | null;
    wins: number;
    losses: number;
    pointsFor: number;
  };
  leagueId: string;
  leagueName: string;
  leagueColor: string;
  powerScore: number;
  rank: number;
}

// Manual entry: just team name per slot
interface ManualSlot {
  teamName: string;
}

const LEAGUE_OPTIONS = [
  { name: 'Sales', color: '#3b82f6' },
  { name: 'Accounting', color: '#10b981' },
];

/**
 * Generate the Scranton Branch bracket structure:
 * - Week 1: #2 vs #3 within each league (seeds 1 on bye)
 * - Week 2: #1 vs Week 1 winner within each league (league championship)
 * - Week 3: Sales champ vs Accounting champ (the final)
 *
 * Seeds: Sales #1=1, Sales #2=2, Sales #3=3, Acct #1=4, Acct #2=5, Acct #3=6
 */
function generateLeagueBracket(): BracketMatchup[] {
  return [
    // Week 1: League play-in (2 vs 3 within each league)
    { id: 'W1-SALES', round: 1, position: 0, team1Seed: 2, team2Seed: 3, team1Score: null, team2Score: null, winningSeed: null, label: 'Sales Play-In (#2 vs #3)' },
    { id: 'W1-ACCT', round: 1, position: 1, team1Seed: 5, team2Seed: 6, team1Score: null, team2Score: null, winningSeed: null, label: 'Accounting Play-In (#2 vs #3)' },
    // Week 2: League championship (1 vs play-in winner)
    { id: 'W2-SALES', round: 2, position: 0, team1Seed: 1, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Sales Championship (#1 vs Play-In Winner)' },
    { id: 'W2-ACCT', round: 2, position: 1, team1Seed: 4, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Accounting Championship (#1 vs Play-In Winner)' },
    // Week 3: The final
    { id: 'FINAL', round: 3, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Scranton Branch Championship' },
  ];
}

export default function BracketManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [rankings, setRankings] = useState<RankedTeam[]>([]);
  const [step, setStep] = useState<'setup' | 'manual' | 'manage'>('setup');
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear().toString());

  // Manual entry: 6 slots (Sales #1, #2, #3, Acct #1, #2, #3)
  const [manualSlots, setManualSlots] = useState<ManualSlot[]>([
    { teamName: '' }, { teamName: '' }, { teamName: '' },
    { teamName: '' }, { teamName: '' }, { teamName: '' },
  ]);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/bracket').then((r) => {
        if (r.status === 401) { router.push('/admin'); return null; }
        return r.json();
      }),
      fetch('/api/rankings').then((r) => r.ok ? r.json() : null),
    ]).then(([bracketRes, rankingsRes]) => {
      if (bracketRes?.bracket) {
        setBracket(bracketRes.bracket);
        setStep('manage');
      }
      if (rankingsRes?.rankings) {
        setRankings(rankingsRes.rankings);
      }
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleSeedFromRankings() {
    if (!rankings.length) {
      setMessage('No power rankings available to seed from.');
      return;
    }

    const leagueTeams: Record<string, RankedTeam[]> = {};
    for (const r of rankings) {
      if (!leagueTeams[r.leagueId]) leagueTeams[r.leagueId] = [];
      leagueTeams[r.leagueId].push(r);
    }

    // Take top 3 from each league, keep them in league order
    const teams: BracketTeam[] = [];
    let seed = 1;

    for (const league of LEAGUE_OPTIONS) {
      const leagueId = Object.keys(leagueTeams).find((id) => {
        const first = leagueTeams[id][0];
        return first?.leagueName === league.name;
      });
      if (!leagueId) continue;
      const top3 = leagueTeams[leagueId].slice(0, 3);
      for (const q of top3) {
        teams.push({
          rosterId: q.team.rosterId,
          leagueId: q.leagueId,
          leagueName: q.leagueName,
          leagueColor: q.leagueColor,
          teamName: q.team.teamName ?? q.team.displayName,
          displayName: q.team.displayName,
          avatar: q.team.avatar,
          wins: q.team.wins,
          losses: q.team.losses,
          pointsFor: q.team.pointsFor,
          seed: seed++,
        });
      }
    }

    const matchups = generateLeagueBracket();
    const newBracket: BracketData = {
      seasonYear,
      teams,
      matchups,
      rounds: 3,
      status: 'pending',
      champion: null,
    };

    setBracket(newBracket);
    setStep('manage');
    setMessage('Bracket seeded from power rankings! Enter scores and save.');
  }

  function handleManualCreate() {
    for (let i = 0; i < manualSlots.length; i++) {
      if (!manualSlots[i].teamName.trim()) {
        const labels = ['Sales #1', 'Sales #2', 'Sales #3', 'Acct #1', 'Acct #2', 'Acct #3'];
        setMessage(`${labels[i]} needs a team name.`);
        return;
      }
    }

    const teams: BracketTeam[] = manualSlots.map((slot, i) => {
      const isAcct = i >= 3;
      const league = isAcct ? LEAGUE_OPTIONS[1] : LEAGUE_OPTIONS[0];
      return {
        rosterId: i + 1,
        leagueId: league.name.toLowerCase(),
        leagueName: league.name,
        leagueColor: league.color,
        teamName: slot.teamName,
        displayName: slot.teamName,
        avatar: null,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        seed: i + 1,
      };
    });

    const matchups = generateLeagueBracket();
    const newBracket: BracketData = {
      seasonYear,
      teams,
      matchups,
      rounds: 3,
      status: 'pending',
      champion: null,
    };

    setBracket(newBracket);
    setStep('manage');
    setMessage('Bracket created! Enter scores for each week and save.');
  }

  function updateMatchupScore(matchupId: string, field: 'team1Score' | 'team2Score', value: string) {
    if (!bracket) return;
    const updated = bracket.matchups.map((m) => {
      if (m.id !== matchupId) return m;
      return { ...m, [field]: value === '' ? null : parseFloat(value) };
    });
    setBracket({ ...bracket, matchups: updated });
  }

  function setMatchupWinner(matchupId: string) {
    if (!bracket) return;

    const matchup = bracket.matchups.find((m) => m.id === matchupId);
    if (!matchup || matchup.team1Score === null || matchup.team2Score === null) return;

    const winningSeed = matchup.team1Score >= matchup.team2Score
      ? matchup.team1Seed
      : matchup.team2Seed;

    let updatedMatchups = bracket.matchups.map((m) => {
      if (m.id !== matchupId) return m;
      return { ...m, winningSeed };
    });

    // Advance winner based on our specific bracket structure
    if (matchupId === 'W1-SALES') {
      // Winner goes to W2-SALES as team2
      updatedMatchups = updatedMatchups.map((m) =>
        m.id === 'W2-SALES' ? { ...m, team2Seed: winningSeed } : m
      );
    } else if (matchupId === 'W1-ACCT') {
      // Winner goes to W2-ACCT as team2
      updatedMatchups = updatedMatchups.map((m) =>
        m.id === 'W2-ACCT' ? { ...m, team2Seed: winningSeed } : m
      );
    } else if (matchupId === 'W2-SALES') {
      // Sales champ goes to FINAL as team1
      updatedMatchups = updatedMatchups.map((m) =>
        m.id === 'FINAL' ? { ...m, team1Seed: winningSeed } : m
      );
    } else if (matchupId === 'W2-ACCT') {
      // Acct champ goes to FINAL as team2
      updatedMatchups = updatedMatchups.map((m) =>
        m.id === 'FINAL' ? { ...m, team2Seed: winningSeed } : m
      );
    }

    // Check if champion
    const finalMatch = updatedMatchups.find((m) => m.id === 'FINAL');
    let champion = bracket.champion;
    if (finalMatch?.winningSeed) {
      champion = bracket.teams.find((t) => t.seed === finalMatch.winningSeed) ?? null;
    }

    const hasAnyResult = updatedMatchups.some((m) => m.winningSeed !== null);
    const isComplete = finalMatch?.winningSeed !== null;

    setBracket({
      ...bracket,
      matchups: updatedMatchups,
      champion,
      status: isComplete ? 'complete' : hasAnyResult ? 'in_progress' : 'pending',
    });
  }

  async function handleSave() {
    if (!bracket) return;
    setSaving(true);
    setMessage('');

    const res = await fetch('/api/admin/bracket', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bracket }),
    });

    if (res.ok) {
      setMessage('Bracket saved! It will appear on the public bracket page.');
    } else {
      const err = await res.json();
      setMessage(`Error: ${err.error}`);
    }
    setSaving(false);
  }

  function getTeamBySeed(seed: number | null): BracketTeam | null {
    if (!seed || !bracket) return null;
    return bracket.teams.find((t) => t.seed === seed) ?? null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  // --- SETUP SCREEN ---
  if (step === 'setup' && !bracket) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Bracket Manager</h1>
          <p className="text-text-secondary text-sm mt-1">
            3-week playoff: league play-in, league championship, then Sales vs Accounting final.
          </p>
        </div>

        {/* Option 1: Auto-seed */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-bold text-white">Option 1: Auto-Seed from Rankings</h2>
          <p className="text-text-secondary text-sm">
            Pull the top 3 from each league based on current power rankings.
          </p>
          <button
            onClick={handleSeedFromRankings}
            disabled={!rankings.length}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {rankings.length ? 'Seed from Power Rankings' : 'No Rankings Available'}
          </button>
        </div>

        {/* Option 2: Manual */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-bold text-white">Option 2: Manual Entry</h2>
          <p className="text-text-secondary text-sm">
            Type in the 6 playoff team names. Use this for past seasons.
          </p>
          <button
            onClick={() => setStep('manual')}
            className="px-6 py-2 bg-accent-purple/80 text-white rounded-lg font-semibold hover:bg-accent-purple transition-colors"
          >
            Enter Teams Manually
          </button>
        </div>

        {message && (
          <p className={`text-sm ${message.startsWith('Error') ? 'text-accent-red' : 'text-accent-green'}`}>
            {message}
          </p>
        )}
      </div>
    );
  }

  // --- MANUAL ENTRY SCREEN ---
  if (step === 'manual') {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Manual Bracket Setup</h1>
          <p className="text-text-secondary text-sm mt-1">
            Enter the top 3 teams from each league in seed order.
          </p>
        </div>

        {/* Season year */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">Season Year:</label>
            <input
              type="text"
              value={seasonYear}
              onChange={(e) => setSeasonYear(e.target.value)}
              className="w-24 px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Sales league */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LEAGUE_OPTIONS[0].color }} />
            <h2 className="font-bold text-white">Sales League</h2>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-bold text-text-muted w-6">#{i + 1}</span>
              <input
                type="text"
                value={manualSlots[i].teamName}
                onChange={(e) => {
                  const updated = [...manualSlots];
                  updated[i] = { teamName: e.target.value };
                  setManualSlots(updated);
                }}
                placeholder={i === 0 ? '#1 seed (bye week 1)' : `#${i + 1} seed`}
                className="flex-1 px-3 py-2 rounded bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
              {i === 0 && <span className="text-xs text-accent-gold">BYE</span>}
            </div>
          ))}
        </div>

        {/* Accounting league */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LEAGUE_OPTIONS[1].color }} />
            <h2 className="font-bold text-white">Accounting League</h2>
          </div>
          {[3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-bold text-text-muted w-6">#{i - 2}</span>
              <input
                type="text"
                value={manualSlots[i].teamName}
                onChange={(e) => {
                  const updated = [...manualSlots];
                  updated[i] = { teamName: e.target.value };
                  setManualSlots(updated);
                }}
                placeholder={i === 3 ? '#1 seed (bye week 1)' : `#${i - 2} seed`}
                className="flex-1 px-3 py-2 rounded bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
              {i === 3 && <span className="text-xs text-accent-gold">BYE</span>}
            </div>
          ))}
        </div>

        {/* Bracket explanation */}
        <div className="glass-card p-4 bg-white/5">
          <p className="text-xs text-text-muted leading-relaxed">
            <strong className="text-text-secondary">How the bracket works:</strong><br />
            Week 1: #2 vs #3 in each league (#1 seeds on bye)<br />
            Week 2: #1 vs play-in winner in each league (league championship)<br />
            Week 3: Sales champ vs Accounting champ (the big one)
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleManualCreate}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
          >
            Create Bracket
          </button>
          <button
            onClick={() => { setStep('setup'); setMessage(''); }}
            className="px-4 py-2 text-text-secondary hover:text-white transition-colors text-sm"
          >
            Back
          </button>
          {message && (
            <p className={`text-sm ${message.startsWith('Error') ? 'text-accent-red' : 'text-accent-green'}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!bracket) return null;

  // --- MANAGE SCREEN ---
  // Group matchups by round
  const roundLabels: Record<number, string> = {
    1: 'Week 1 — Play-In Round',
    2: 'Week 2 — League Championships',
    3: 'Week 3 — Scranton Branch Championship',
  };

  const rounds: Record<number, BracketMatchup[]> = {};
  for (const m of bracket.matchups) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Bracket Manager</h1>
        <p className="text-text-secondary text-sm mt-1">
          {bracket.seasonYear} Season — Enter scores for each week, confirm winners to advance.
        </p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          bracket.status === 'complete'
            ? 'bg-accent-gold/20 text-accent-gold'
            : bracket.status === 'in_progress'
              ? 'bg-accent-green/20 text-accent-green'
              : 'bg-white/10 text-text-muted'
        }`}>
          {bracket.status === 'complete' ? 'Complete' : bracket.status === 'in_progress' ? 'In Progress' : 'Pending'}
        </span>
        {bracket.champion && (
          <span className="text-sm text-accent-gold font-semibold">
            Champion: {bracket.champion.teamName}
          </span>
        )}
      </div>

      {/* Matchup editor by round */}
      {roundNumbers.map((roundNum) => (
        <div key={roundNum} className="glass-card p-6 space-y-4">
          <h2 className={`font-bold ${roundNum === 3 ? 'text-accent-gold' : 'text-white'}`}>
            {roundLabels[roundNum] || `Round ${roundNum}`}
          </h2>

          {rounds[roundNum].map((matchup) => {
            const team1 = getTeamBySeed(matchup.team1Seed);
            const team2 = getTeamBySeed(matchup.team2Seed);
            const canSetWinner = matchup.team1Score !== null && matchup.team2Score !== null
              && matchup.team1Seed !== null && matchup.team2Seed !== null;

            return (
              <div key={matchup.id} className="p-4 rounded-lg bg-bg-tertiary space-y-3">
                <p className="text-xs text-text-muted font-semibold">{matchup.label}</p>

                {/* Team 1 */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {team1?.teamName ?? (matchup.team1Seed ? `Seed #${matchup.team1Seed}` : 'TBD')}
                      </span>
                      {team1 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: `${team1.leagueColor}22`, color: team1.leagueColor }}
                        >
                          {team1.leagueName}
                        </span>
                      )}
                      {matchup.winningSeed === matchup.team1Seed && matchup.winningSeed !== null && (
                        <span className="text-accent-green text-xs font-bold">W</span>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Score"
                    value={matchup.team1Score ?? ''}
                    onChange={(e) => updateMatchupScore(matchup.id, 'team1Score', e.target.value)}
                    className="w-24 px-3 py-1.5 rounded bg-bg-secondary border border-white/10 text-white text-sm stat focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Team 2 */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {team2?.teamName ?? (matchup.team2Seed ? `Seed #${matchup.team2Seed}` : 'TBD')}
                      </span>
                      {team2 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: `${team2.leagueColor}22`, color: team2.leagueColor }}
                        >
                          {team2.leagueName}
                        </span>
                      )}
                      {matchup.winningSeed === matchup.team2Seed && matchup.winningSeed !== null && (
                        <span className="text-accent-green text-xs font-bold">W</span>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Score"
                    value={matchup.team2Score ?? ''}
                    onChange={(e) => updateMatchupScore(matchup.id, 'team2Score', e.target.value)}
                    className="w-24 px-3 py-1.5 rounded bg-bg-secondary border border-white/10 text-white text-sm stat focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Confirm winner button */}
                {matchup.winningSeed === null && (
                  <button
                    onClick={() => setMatchupWinner(matchup.id)}
                    disabled={!canSetWinner}
                    className="text-sm px-4 py-1.5 bg-accent-green/20 text-accent-green rounded-lg font-semibold hover:bg-accent-green/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Confirm Winner & Advance
                  </button>
                )}
                {matchup.winningSeed !== null && (
                  <p className="text-xs text-accent-green">
                    Winner: {getTeamBySeed(matchup.winningSeed)?.teamName ?? `Seed #${matchup.winningSeed}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Save + Reset */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Bracket'}
        </button>
        <button
          onClick={() => { setBracket(null); setStep('setup'); setMessage(''); }}
          className="px-4 py-2 text-text-secondary hover:text-white transition-colors text-sm"
        >
          Reset Bracket
        </button>
        {message && (
          <p className={`text-sm ${message.startsWith('Error') ? 'text-accent-red' : 'text-accent-green'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
