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

interface ManualTeamEntry {
  teamName: string;
  leagueName: string;
  leagueColor: string;
  wins: string;
  losses: string;
  pointsFor: string;
}

const LEAGUE_OPTIONS = [
  { name: 'Sales', color: '#3b82f6' },
  { name: 'Accounting', color: '#10b981' },
];

export default function BracketManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [rankings, setRankings] = useState<RankedTeam[]>([]);
  const [step, setStep] = useState<'setup' | 'manual' | 'manage'>('setup');
  const [teamCount, setTeamCount] = useState(6);
  const [manualTeams, setManualTeams] = useState<ManualTeamEntry[]>([]);

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

    const qualifiersPerLeague = 3; // from config
    const leagueTeams: Record<string, RankedTeam[]> = {};

    // Group by league
    for (const r of rankings) {
      if (!leagueTeams[r.leagueId]) leagueTeams[r.leagueId] = [];
      leagueTeams[r.leagueId].push(r);
    }

    // Take top N from each league (already sorted by power score)
    const qualifiers: RankedTeam[] = [];
    for (const leagueId of Object.keys(leagueTeams)) {
      const leagueRanked = leagueTeams[leagueId];
      qualifiers.push(...leagueRanked.slice(0, qualifiersPerLeague));
    }

    // Sort all qualifiers by power score for overall seeding
    qualifiers.sort((a, b) => b.powerScore - a.powerScore);

    const teams: BracketTeam[] = qualifiers.map((q, i) => ({
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
      seed: i + 1,
    }));

    // Generate bracket structure
    const teamCount = teams.length;
    const res = await fetch('/api/admin/bracket/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamCount }),
    });

    let matchups: BracketMatchup[];
    if (res.ok) {
      const data = await res.json();
      matchups = data.matchups;
    } else {
      // Fallback: generate client-side for simple case (6 teams)
      matchups = generateMatchupsClientSide(teamCount);
    }

    const newBracket: BracketData = {
      seasonYear: new Date().getFullYear().toString(),
      teams,
      matchups,
      rounds: Math.max(...matchups.map((m) => m.round)),
      status: 'pending',
      champion: null,
    };

    setBracket(newBracket);
    setStep('manage');
    setMessage('Bracket seeded from power rankings! Enter scores and save.');
  }

  function startManualSetup() {
    const entries: ManualTeamEntry[] = [];
    for (let i = 0; i < teamCount; i++) {
      entries.push({
        teamName: '',
        leagueName: LEAGUE_OPTIONS[0].name,
        leagueColor: LEAGUE_OPTIONS[0].color,
        wins: '',
        losses: '',
        pointsFor: '',
      });
    }
    setManualTeams(entries);
    setStep('manual');
  }

  function updateManualTeam(index: number, field: keyof ManualTeamEntry, value: string) {
    const updated = [...manualTeams];
    updated[index] = { ...updated[index], [field]: value };
    // Sync color when league changes
    if (field === 'leagueName') {
      const opt = LEAGUE_OPTIONS.find((o) => o.name === value);
      if (opt) updated[index].leagueColor = opt.color;
    }
    setManualTeams(updated);
  }

  function handleManualCreate() {
    // Validate
    for (let i = 0; i < manualTeams.length; i++) {
      if (!manualTeams[i].teamName.trim()) {
        setMessage(`Seed #${i + 1} needs a team name.`);
        return;
      }
    }

    const teams: BracketTeam[] = manualTeams.map((entry, i) => ({
      rosterId: i + 1,
      leagueId: entry.leagueName.toLowerCase(),
      leagueName: entry.leagueName,
      leagueColor: entry.leagueColor,
      teamName: entry.teamName,
      displayName: entry.teamName,
      avatar: null,
      wins: parseInt(entry.wins) || 0,
      losses: parseInt(entry.losses) || 0,
      pointsFor: parseFloat(entry.pointsFor) || 0,
      seed: i + 1,
    }));

    const matchups = generateMatchupsClientSide(teams.length);

    const newBracket: BracketData = {
      seasonYear: new Date().getFullYear().toString(),
      teams,
      matchups,
      rounds: Math.max(...matchups.map((m) => m.round)),
      status: 'pending',
      champion: null,
    };

    setBracket(newBracket);
    setStep('manage');
    setMessage('Bracket created! Enter scores and save.');
  }

  function generateMatchupsClientSide(teamCount: number): BracketMatchup[] {
    if (teamCount <= 4) {
      return [
        { id: 'R1-M1', round: 1, position: 0, team1Seed: 1, team2Seed: 4, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
        { id: 'R1-M2', round: 1, position: 1, team1Seed: 2, team2Seed: 3, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
        { id: 'FINAL', round: 2, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
      ];
    }
    // 6 teams (most likely: 3 per league x 2 leagues)
    return [
      { id: 'R1-M1', round: 1, position: 0, team1Seed: 3, team2Seed: 6, team1Score: null, team2Score: null, winningSeed: null, label: 'Play-In 1' },
      { id: 'R1-M2', round: 1, position: 1, team1Seed: 4, team2Seed: 5, team1Score: null, team2Score: null, winningSeed: null, label: 'Play-In 2' },
      { id: 'R2-M1', round: 2, position: 0, team1Seed: 1, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
      { id: 'R2-M2', round: 2, position: 1, team1Seed: 2, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
      { id: 'FINAL', round: 3, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
    ];
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

    // Advance winner to next round
    updatedMatchups = advanceWinner(updatedMatchups, matchup, winningSeed, bracket.teams.length);

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

  function advanceWinner(
    matchups: BracketMatchup[],
    completedMatchup: BracketMatchup,
    winningSeed: number | null,
    teamCount: number,
  ): BracketMatchup[] {
    if (!winningSeed) return matchups;

    // Determine the next round matchup this winner feeds into
    const currentRound = completedMatchup.round;
    const currentPos = completedMatchup.position;

    // Find the next round matchup
    const nextRound = currentRound + 1;
    const nextPos = Math.floor(currentPos / 2);
    const isTopSlot = currentPos % 2 === 0;

    const nextMatchup = matchups.find(
      (m) => m.round === nextRound && m.position === nextPos
    );

    if (!nextMatchup) return matchups; // Already at final

    return matchups.map((m) => {
      if (m.id !== nextMatchup.id) return m;
      if (isTopSlot) {
        return { ...m, team1Seed: winningSeed };
      } else {
        return { ...m, team2Seed: winningSeed };
      }
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

  function getTeamBySeeed(seed: number | null): BracketTeam | null {
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

  if (step === 'setup' && !bracket) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Bracket Manager</h1>
          <p className="text-text-secondary text-sm mt-1">
            Seed the championship bracket and input matchup results.
          </p>
        </div>

        {/* Option 1: Auto-seed */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-bold text-white">Option 1: Auto-Seed from Rankings</h2>
          <p className="text-text-secondary text-sm">
            Seed the bracket automatically from the current power rankings.
            Top 3 from each league will qualify.
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
          <h2 className="font-bold text-white">Option 2: Manual Setup</h2>
          <p className="text-text-secondary text-sm">
            Manually enter the playoff teams, their seeds, and scores.
            Use this for past seasons or custom brackets.
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">Number of teams:</label>
            <select
              value={teamCount}
              onChange={(e) => setTeamCount(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
            >
              <option value={4}>4 teams</option>
              <option value={6}>6 teams (default)</option>
              <option value={8}>8 teams</option>
            </select>
          </div>
          <button
            onClick={startManualSetup}
            className="px-6 py-2 bg-accent-purple/80 text-white rounded-lg font-semibold hover:bg-accent-purple transition-colors"
          >
            Set Up Manually
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

  if (step === 'manual') {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Manual Bracket Setup</h1>
          <p className="text-text-secondary text-sm mt-1">
            Enter the {teamCount} playoff teams in seed order (#1 = best seed).
          </p>
        </div>

        {manualTeams.map((entry, i) => (
          <div key={i} className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-text-muted w-8">#{i + 1}</span>
              <span className="text-sm text-text-secondary">Seed</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Team Name</label>
                <input
                  type="text"
                  value={entry.teamName}
                  onChange={(e) => updateManualTeam(i, 'teamName', e.target.value)}
                  placeholder="e.g. Bed, Bath and Bijan"
                  className="w-full px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">League</label>
                <select
                  value={entry.leagueName}
                  onChange={(e) => updateManualTeam(i, 'leagueName', e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                >
                  {LEAGUE_OPTIONS.map((opt) => (
                    <option key={opt.name} value={opt.name}>{opt.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Wins</label>
                <input
                  type="number"
                  value={entry.wins}
                  onChange={(e) => updateManualTeam(i, 'wins', e.target.value)}
                  placeholder="10"
                  className="w-full px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm stat focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Losses</label>
                <input
                  type="number"
                  value={entry.losses}
                  onChange={(e) => updateManualTeam(i, 'losses', e.target.value)}
                  placeholder="4"
                  className="w-full px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm stat focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Total PF</label>
                <input
                  type="number"
                  step="0.01"
                  value={entry.pointsFor}
                  onChange={(e) => updateManualTeam(i, 'pointsFor', e.target.value)}
                  placeholder="1523.50"
                  className="w-full px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm stat focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        ))}

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

  // Group matchups by round
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
          Enter scores for each matchup. Confirm the winner to advance them.
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
          <h2 className="font-bold text-white">
            {rounds[roundNum][0]?.label.replace(/\s\d+$/, '') || `Round ${roundNum}`}
          </h2>

          {rounds[roundNum].map((matchup) => {
            const team1 = getTeamBySeeed(matchup.team1Seed);
            const team2 = getTeamBySeeed(matchup.team2Seed);
            const canSetWinner = matchup.team1Score !== null && matchup.team2Score !== null
              && matchup.team1Seed !== null && matchup.team2Seed !== null;

            return (
              <div key={matchup.id} className="p-4 rounded-lg bg-bg-tertiary space-y-3">
                <p className="text-xs text-text-muted font-semibold">{matchup.label}</p>

                {/* Team 1 */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {team1 && (
                        <span className="text-xs text-text-muted">#{team1.seed}</span>
                      )}
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
                      {team2 && (
                        <span className="text-xs text-text-muted">#{team2.seed}</span>
                      )}
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
                    Winner: {getTeamBySeeed(matchup.winningSeed)?.teamName ?? `Seed #${matchup.winningSeed}`}
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
