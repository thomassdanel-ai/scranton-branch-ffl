'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLeagueConfig } from '@/components/providers/ConfigProvider';
import { ORG_SHORT_NAME } from '@/config/constants';
import type { LeagueInfo } from '@/lib/config';

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
  playoffStartWeek?: number;
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

interface ManualSlot {
  teamName: string;
  rosterId?: number;
}

function generateLeagueBracket(leagues: LeagueInfo[]): BracketMatchup[] {
  if (leagues.length < 2) return [];
  const l0 = leagues[0].shortName;
  const l1 = leagues[1].shortName;
  return [
    { id: `W1-${l0}`, round: 1, position: 0, team1Seed: 2, team2Seed: 3, team1Score: null, team2Score: null, winningSeed: null, label: `${leagues[0].name} Play-In (#2 vs #3)` },
    { id: `W1-${l1}`, round: 1, position: 1, team1Seed: 5, team2Seed: 6, team1Score: null, team2Score: null, winningSeed: null, label: `${leagues[1].name} Play-In (#2 vs #3)` },
    { id: `W2-${l0}`, round: 2, position: 0, team1Seed: 1, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: `${leagues[0].name} Championship (#1 vs Play-In Winner)` },
    { id: `W2-${l1}`, round: 2, position: 1, team1Seed: 4, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: `${leagues[1].name} Championship (#1 vs Play-In Winner)` },
    { id: 'FINAL', round: 3, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: `${ORG_SHORT_NAME} Championship` },
  ];
}

function getAdvancementMap(leagues: LeagueInfo[]): Record<string, { target: string; slot: 'team1Seed' | 'team2Seed' }> {
  if (leagues.length < 2) return {};
  const l0 = leagues[0].shortName;
  const l1 = leagues[1].shortName;
  return {
    [`W1-${l0}`]: { target: `W2-${l0}`, slot: 'team2Seed' },
    [`W1-${l1}`]: { target: `W2-${l1}`, slot: 'team2Seed' },
    [`W2-${l0}`]: { target: 'FINAL', slot: 'team1Seed' },
    [`W2-${l1}`]: { target: 'FINAL', slot: 'team2Seed' },
  };
}

export default function BracketManagerPage() {
  const router = useRouter();
  const { leagues, seasonYear: ctxYear } = useLeagueConfig();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [rankings, setRankings] = useState<RankedTeam[]>([]);
  const [step, setStep] = useState<'setup' | 'manual' | 'manage'>('setup');
  const [seasonYear, setSeasonYear] = useState(ctxYear || new Date().getFullYear().toString());

  const [playoffStartWeek, setPlayoffStartWeek] = useState(15);
  const [pullingScores, setPullingScores] = useState(false);

  const qualifiersPerLeague = 3;
  const totalSlots = leagues.length * qualifiersPerLeague;
  const [manualSlots, setManualSlots] = useState<ManualSlot[]>(
    Array.from({ length: totalSlots }, () => ({ teamName: '' }))
  );

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
        if (bracketRes.bracket.playoffStartWeek) {
          setPlayoffStartWeek(bracketRes.bracket.playoffStartWeek);
        }
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

    const teams: BracketTeam[] = [];
    let seed = 1;

    for (const league of leagues) {
      const leagueId = Object.keys(leagueTeams).find((id) => {
        const first = leagueTeams[id][0];
        return first?.leagueName === league.name;
      });
      if (!leagueId) continue;
      const top = leagueTeams[leagueId].slice(0, qualifiersPerLeague);
      for (const q of top) {
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

    const matchups = generateLeagueBracket(leagues);
    const newBracket: BracketData = {
      seasonYear,
      teams,
      matchups,
      rounds: 3,
      status: 'pending',
      champion: null,
      playoffStartWeek,
    };

    setBracket(newBracket);
    setStep('manage');
    setMessage('Bracket seeded from power rankings! Enter scores and save.');
  }

  function handleManualCreate() {
    for (let i = 0; i < manualSlots.length; i++) {
      if (!manualSlots[i].teamName.trim()) {
        const leagueIdx = Math.floor(i / qualifiersPerLeague);
        const seedInLeague = (i % qualifiersPerLeague) + 1;
        const leagueName = leagues[leagueIdx]?.shortName ?? `League ${leagueIdx + 1}`;
        setMessage(`${leagueName} #${seedInLeague} needs a team name.`);
        return;
      }
    }

    const teams: BracketTeam[] = manualSlots.map((slot, i) => {
      const leagueIdx = Math.floor(i / qualifiersPerLeague);
      const league = leagues[leagueIdx];
      return {
        rosterId: slot.rosterId ?? (i + 1),
        leagueId: league?.sleeperId ?? '',
        leagueName: league?.name ?? '',
        leagueColor: league?.color ?? '#6b7280',
        teamName: slot.teamName,
        displayName: slot.teamName,
        avatar: null,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        seed: i + 1,
      };
    });

    const matchups = generateLeagueBracket(leagues);
    const newBracket: BracketData = {
      seasonYear,
      teams,
      matchups,
      rounds: 3,
      status: 'pending',
      champion: null,
      playoffStartWeek,
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

    const advancement = getAdvancementMap(leagues);
    const adv = advancement[matchupId];
    if (adv) {
      updatedMatchups = updatedMatchups.map((m) =>
        m.id === adv.target ? { ...m, [adv.slot]: winningSeed } : m
      );
    }

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

  async function pullScoresForRound(roundNum: number) {
    if (!bracket) return;

    const week = (bracket.playoffStartWeek || playoffStartWeek) + roundNum - 1;
    const roundMatchups = bracket.matchups.filter((m) => m.round === roundNum);

    const teamsInRound: BracketTeam[] = [];
    for (const m of roundMatchups) {
      if (m.team1Seed) {
        const found = bracket.teams.find((t) => t.seed === m.team1Seed);
        if (found) teamsInRound.push(found);
      }
      if (m.team2Seed) {
        const found = bracket.teams.find((t) => t.seed === m.team2Seed);
        if (found) teamsInRound.push(found);
      }
    }

    if (teamsInRound.length === 0) {
      setMessage('No teams set for this round yet.');
      return;
    }

    const hasRealIds = teamsInRound.every((t) => t.leagueId.length > 10);
    if (!hasRealIds) {
      setMessage('Cannot pull scores - teams need real Sleeper league IDs. Re-create bracket with auto-seed or update teams.');
      return;
    }

    setPullingScores(true);
    setMessage('');

    try {
      const leagueIdSet: Record<string, boolean> = {};
      for (const t of teamsInRound) leagueIdSet[t.leagueId] = true;
      const leagueIds = Object.keys(leagueIdSet);

      const allScores: Record<string, Record<number, number>> = {};
      for (const lid of leagueIds) {
        const res = await fetch('/api/admin/bracket/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leagueId: lid, week }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to fetch scores');
        }
        const data = await res.json();
        allScores[lid] = data.scores;
      }

      let filledCount = 0;
      const updatedMatchups = bracket.matchups.map((m) => {
        if (m.round !== roundNum) return m;

        let team1Score = m.team1Score;
        let team2Score = m.team2Score;

        if (m.team1Seed) {
          const team = bracket.teams.find((bt) => bt.seed === m.team1Seed);
          if (team && allScores[team.leagueId] && allScores[team.leagueId][team.rosterId] !== undefined) {
            team1Score = allScores[team.leagueId][team.rosterId];
            filledCount++;
          }
        }
        if (m.team2Seed) {
          const team = bracket.teams.find((bt) => bt.seed === m.team2Seed);
          if (team && allScores[team.leagueId] && allScores[team.leagueId][team.rosterId] !== undefined) {
            team2Score = allScores[team.leagueId][team.rosterId];
            filledCount++;
          }
        }

        return { ...m, team1Score, team2Score };
      });

      setBracket({ ...bracket, matchups: updatedMatchups });
      if (filledCount > 0) {
        setMessage('Pulled ' + filledCount + ' score(s) from Sleeper (NFL Week ' + week + '). Review and confirm winners.');
      } else {
        setMessage('No scores found for NFL Week ' + week + '. Games may not have started yet.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage('Error pulling scores: ' + msg);
    } finally {
      setPullingScores(false);
    }
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
            3-week playoff: league play-in, league championship, then cross-league final.
          </p>
        </div>

        {/* Playoff start week */}
        <div className="glass-card p-4 flex items-center gap-4 flex-wrap">
          <label className="text-sm text-text-secondary">Playoff Start Week (NFL):</label>
          <input
            type="number"
            min={1}
            max={18}
            value={playoffStartWeek}
            onChange={(e) => setPlayoffStartWeek(parseInt(e.target.value) || 15)}
            className="w-20 px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm stat focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-text-muted">
            Needed for auto-pulling scores from Sleeper
          </span>
        </div>

        {/* Option 1: Auto-seed */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-bold text-white">Option 1: Auto-Seed from Rankings</h2>
          <p className="text-text-secondary text-sm">
            Pull the top {qualifiersPerLeague} from each league based on current power rankings. Scores can be auto-pulled from Sleeper.
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
            Type in the {totalSlots} playoff team names. Use this for past seasons.
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
            Enter the top {qualifiersPerLeague} teams from each league in seed order.
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

        {/* League entry sections */}
        {leagues.map((league, leagueIdx) => {
          const startIdx = leagueIdx * qualifiersPerLeague;
          return (
            <div key={league.dbId} className="glass-card p-6 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: league.color }} />
                <h2 className="font-bold text-white">{league.name} League</h2>
              </div>
              {Array.from({ length: qualifiersPerLeague }, (_, j) => {
                const i = startIdx + j;
                const seedNum = j + 1;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-text-muted w-6">#{seedNum}</span>
                    <input
                      type="text"
                      value={manualSlots[i]?.teamName ?? ''}
                      onChange={(e) => {
                        const updated = [...manualSlots];
                        updated[i] = { teamName: e.target.value };
                        setManualSlots(updated);
                      }}
                      placeholder={seedNum === 1 ? '#1 seed (bye week 1)' : `#${seedNum} seed`}
                      className="flex-1 px-3 py-2 rounded bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                    />
                    {seedNum === 1 && <span className="text-xs text-accent-gold">BYE</span>}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Bracket explanation */}
        <div className="glass-card p-4 bg-white/5">
          <p className="text-xs text-text-muted leading-relaxed">
            <strong className="text-text-secondary">How the bracket works:</strong><br />
            Week 1: #2 vs #3 in each league (#1 seeds on bye)<br />
            Week 2: #1 vs play-in winner in each league (league championship)<br />
            Week 3: {leagues[0]?.name ?? 'League 1'} champ vs {leagues[1]?.name ?? 'League 2'} champ (the big one)
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
  const roundLabels: Record<number, string> = {
    1: 'Week 1 — Play-In Round',
    2: 'Week 2 — League Championships',
    3: `Week 3 — ${ORG_SHORT_NAME} Championship`,
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

      {/* Playoff start week config */}
      <div className="glass-card p-4 flex items-center gap-4 flex-wrap">
        <label className="text-sm text-text-secondary">Playoff Start Week (NFL):</label>
        <input
          type="number"
          min={1}
          max={18}
          value={bracket.playoffStartWeek ?? playoffStartWeek}
          onChange={(e) => {
            const week = parseInt(e.target.value) || 15;
            setPlayoffStartWeek(week);
            setBracket({ ...bracket, playoffStartWeek: week });
          }}
          className="w-20 px-3 py-1.5 rounded bg-bg-tertiary border border-white/10 text-white text-sm stat focus:outline-none focus:border-primary"
        />
        <span className="text-xs text-text-muted">
          Week 1 = NFL Wk {bracket.playoffStartWeek ?? playoffStartWeek},
          Week 2 = NFL Wk {(bracket.playoffStartWeek ?? playoffStartWeek) + 1},
          Week 3 = NFL Wk {(bracket.playoffStartWeek ?? playoffStartWeek) + 2}
        </span>
      </div>

      {/* Matchup editor by round */}
      {roundNumbers.map((roundNum) => {
        const nflWeek = (bracket.playoffStartWeek ?? playoffStartWeek) + roundNum - 1;
        const roundHasTeams = rounds[roundNum].some((m) => m.team1Seed !== null || m.team2Seed !== null);
        const roundAlreadyDecided = rounds[roundNum].every((m) => m.winningSeed !== null);

        return (
        <div key={roundNum} className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className={`font-bold ${roundNum === 3 ? 'text-accent-gold' : 'text-white'}`}>
              {roundLabels[roundNum] || `Round ${roundNum}`}
              <span className="text-xs text-text-muted font-normal ml-2">(NFL Week {nflWeek})</span>
            </h2>
            {roundHasTeams && !roundAlreadyDecided && (
              <button
                onClick={() => pullScoresForRound(roundNum)}
                disabled={pullingScores}
                className="px-4 py-1.5 bg-primary/20 text-primary rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                {pullingScores ? 'Pulling...' : 'Pull Scores from Sleeper'}
              </button>
            )}
          </div>

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
        );
      })}

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
