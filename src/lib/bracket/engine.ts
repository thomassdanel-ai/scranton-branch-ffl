import { createServiceClient } from '@/lib/supabase/server';
import { LEAGUE_CONFIG } from '@/config/leagues';

// --- Types ---

export type BracketTeam = {
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
};

export type BracketMatchup = {
  id: string; // e.g. "R1-M1", "R2-M1", "FINAL"
  round: number;
  position: number; // position within the round (0-indexed)
  team1Seed: number | null;
  team2Seed: number | null;
  team1Score: number | null;
  team2Score: number | null;
  winningSeed: number | null;
  label: string; // "Quarterfinal 1", "Semifinal 1", "Championship"
};

export type BracketData = {
  seasonYear: string;
  teams: BracketTeam[];
  matchups: BracketMatchup[];
  rounds: number;
  status: 'pending' | 'in_progress' | 'complete';
  champion: BracketTeam | null;
};

// --- Bracket Generation ---

/**
 * Generate a blank bracket structure based on number of teams.
 * Supports 4, 6, 8, or 10+ teams.
 */
export function generateBracketMatchups(teamCount: number): BracketMatchup[] {
  if (teamCount <= 2) {
    return [{
      id: 'FINAL',
      round: 1,
      position: 0,
      team1Seed: 1,
      team2Seed: 2,
      team1Score: null,
      team2Score: null,
      winningSeed: null,
      label: 'Championship',
    }];
  }

  if (teamCount <= 4) {
    // 4 teams: 2 semis + 1 final
    return [
      { id: 'R1-M1', round: 1, position: 0, team1Seed: 1, team2Seed: 4, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
      { id: 'R1-M2', round: 1, position: 1, team1Seed: 2, team2Seed: 3, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
      { id: 'FINAL', round: 2, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
    ];
  }

  if (teamCount <= 6) {
    // 6 teams: top 2 get byes, 4 play-in games, then semis, then final
    return [
      // Play-in round
      { id: 'R1-M1', round: 1, position: 0, team1Seed: 3, team2Seed: 6, team1Score: null, team2Score: null, winningSeed: null, label: 'Play-In 1' },
      { id: 'R1-M2', round: 1, position: 1, team1Seed: 4, team2Seed: 5, team1Score: null, team2Score: null, winningSeed: null, label: 'Play-In 2' },
      // Semis (1 seed vs winner of play-in 2, 2 seed vs winner of play-in 1)
      { id: 'R2-M1', round: 2, position: 0, team1Seed: 1, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
      { id: 'R2-M2', round: 2, position: 1, team1Seed: 2, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
      // Final
      { id: 'FINAL', round: 3, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
    ];
  }

  if (teamCount <= 8) {
    // 8 teams: quarterfinals, semis, final
    return [
      { id: 'R1-M1', round: 1, position: 0, team1Seed: 1, team2Seed: 8, team1Score: null, team2Score: null, winningSeed: null, label: 'Quarterfinal 1' },
      { id: 'R1-M2', round: 1, position: 1, team1Seed: 4, team2Seed: 5, team1Score: null, team2Score: null, winningSeed: null, label: 'Quarterfinal 2' },
      { id: 'R1-M3', round: 1, position: 2, team1Seed: 2, team2Seed: 7, team1Score: null, team2Score: null, winningSeed: null, label: 'Quarterfinal 3' },
      { id: 'R1-M4', round: 1, position: 3, team1Seed: 3, team2Seed: 6, team1Score: null, team2Score: null, winningSeed: null, label: 'Quarterfinal 4' },
      { id: 'R2-M1', round: 2, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
      { id: 'R2-M2', round: 2, position: 1, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
      { id: 'FINAL', round: 3, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
    ];
  }

  // 10+ teams: play-in round for bottom seeds, then quarterfinals, semis, final
  const playInCount = teamCount - 8; // how many extra beyond 8
  const playInGames = Math.ceil(playInCount); // each play-in replaces a bottom seed
  const matchups: BracketMatchup[] = [];

  // Play-in round: bottom seeds play each other
  for (let i = 0; i < playInGames; i++) {
    const highSeed = 8 - playInGames + i + 1; // e.g. for 10 teams: seeds 7,8
    const lowSeed = teamCount - i; // e.g. for 10 teams: seeds 10,9
    matchups.push({
      id: `R1-M${i + 1}`,
      round: 1,
      position: i,
      team1Seed: highSeed,
      team2Seed: lowSeed,
      team1Score: null,
      team2Score: null,
      winningSeed: null,
      label: `Play-In ${i + 1}`,
    });
  }

  // Quarterfinals
  const qfSeeds: [number | null, number | null][] = [
    [1, null], [4, 5], [2, null], [3, 6],
  ];
  // Fill in known seeds for QF (seeds that don't have play-in games)
  for (let i = 0; i < 4; i++) {
    matchups.push({
      id: `R2-M${i + 1}`,
      round: 2,
      position: i,
      team1Seed: qfSeeds[i][0],
      team2Seed: qfSeeds[i][1],
      team1Score: null,
      team2Score: null,
      winningSeed: null,
      label: `Quarterfinal ${i + 1}`,
    });
  }

  // Semis
  matchups.push(
    { id: 'R3-M1', round: 3, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
    { id: 'R3-M2', round: 3, position: 1, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
  );

  // Final
  matchups.push(
    { id: 'FINAL', round: 4, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
  );

  return matchups;
}

/**
 * Get the total number of rounds for a given team count.
 */
export function getRoundCount(teamCount: number): number {
  if (teamCount <= 2) return 1;
  if (teamCount <= 4) return 2;
  if (teamCount <= 8) return 3;
  return 4;
}

/**
 * Get round labels for display
 */
export function getRoundLabels(teamCount: number): string[] {
  if (teamCount <= 2) return ['Championship'];
  if (teamCount <= 4) return ['Semifinals', 'Championship'];
  if (teamCount <= 6) return ['Play-In', 'Semifinals', 'Championship'];
  if (teamCount <= 8) return ['Quarterfinals', 'Semifinals', 'Championship'];
  return ['Play-In', 'Quarterfinals', 'Semifinals', 'Championship'];
}

// --- Database Operations ---

/**
 * Load bracket data from Supabase for the current season.
 */
export async function loadBracket(): Promise<BracketData | null> {
  const supabase = createServiceClient();

  // Get current season
  const { data: season } = await supabase
    .from('seasons')
    .select('id, year')
    .eq('is_current', true)
    .single();

  if (!season) return null;

  const { data: bracket } = await supabase
    .from('brackets')
    .select('bracket_data')
    .eq('season_id', season.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (!bracket?.bracket_data) return null;

  return bracket.bracket_data as BracketData;
}

/**
 * Save bracket data to Supabase for the current season.
 */
export async function saveBracket(data: BracketData): Promise<void> {
  const supabase = createServiceClient();

  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_current', true)
    .single();

  if (!season) throw new Error('No current season found');

  // Check if bracket already exists for this season
  const { data: existing } = await supabase
    .from('brackets')
    .select('id')
    .eq('season_id', season.id)
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from('brackets')
      .update({ bracket_data: data as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('brackets')
      .insert({ season_id: season.id, bracket_data: data as unknown as Record<string, unknown> });
  }
}

/**
 * Determine bracket status based on matchup results.
 */
export function computeBracketStatus(matchups: BracketMatchup[]): 'pending' | 'in_progress' | 'complete' {
  const hasAnyResult = matchups.some((m) => m.winningSeed !== null);
  const finalMatch = matchups.find((m) => m.id === 'FINAL');
  const isComplete = finalMatch?.winningSeed !== null;

  if (isComplete) return 'complete';
  if (hasAnyResult) return 'in_progress';
  return 'pending';
}

/**
 * Derive the team count from league config.
 */
export function getQualifierCount(): number {
  return LEAGUE_CONFIG.leagues.length * LEAGUE_CONFIG.championship.qualifiersPerLeague;
}
