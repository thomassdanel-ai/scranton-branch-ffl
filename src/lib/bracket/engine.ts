import { createServiceClient } from '@/lib/supabase/server';
import { getSeasonLeagues, getChampionshipConfig } from '@/lib/config';

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
  id: string;
  round: number;
  position: number;
  team1Seed: number | null;
  team2Seed: number | null;
  team1Score: number | null;
  team2Score: number | null;
  winningSeed: number | null;
  label: string;
};

export type BracketData = {
  seasonYear: string;
  teams: BracketTeam[];
  matchups: BracketMatchup[];
  rounds: number;
  status: 'pending' | 'in_progress' | 'complete';
  champion: BracketTeam | null;
  playoffStartWeek?: number;
};

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
    return [
      { id: 'R1-M1', round: 1, position: 0, team1Seed: 1, team2Seed: 4, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
      { id: 'R1-M2', round: 1, position: 1, team1Seed: 2, team2Seed: 3, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
      { id: 'FINAL', round: 2, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
    ];
  }

  if (teamCount <= 6) {
    return [
      { id: 'R1-M1', round: 1, position: 0, team1Seed: 3, team2Seed: 6, team1Score: null, team2Score: null, winningSeed: null, label: 'Play-In 1' },
      { id: 'R1-M2', round: 1, position: 1, team1Seed: 4, team2Seed: 5, team1Score: null, team2Score: null, winningSeed: null, label: 'Play-In 2' },
      // #1 vs play-in 2 winner, #2 vs play-in 1 winner
      { id: 'R2-M1', round: 2, position: 0, team1Seed: 1, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
      { id: 'R2-M2', round: 2, position: 1, team1Seed: 2, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
      { id: 'FINAL', round: 3, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
    ];
  }

  if (teamCount <= 8) {
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

  const playInGames = teamCount - 8;
  const matchups: BracketMatchup[] = [];

  for (let i = 0; i < playInGames; i++) {
    const highSeed = 8 - playInGames + i + 1;
    const lowSeed = teamCount - i;
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

  const qfSeeds: [number | null, number | null][] = [
    [1, null], [4, 5], [2, null], [3, 6],
  ];
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

  matchups.push(
    { id: 'R3-M1', round: 3, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 1' },
    { id: 'R3-M2', round: 3, position: 1, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Semifinal 2' },
  );
  matchups.push(
    { id: 'FINAL', round: 4, position: 0, team1Seed: null, team2Seed: null, team1Score: null, team2Score: null, winningSeed: null, label: 'Championship' },
  );

  return matchups;
}

export function getRoundCount(teamCount: number): number {
  if (teamCount <= 2) return 1;
  if (teamCount <= 4) return 2;
  if (teamCount <= 8) return 3;
  return 4;
}

export function getRoundLabels(teamCount: number): string[] {
  if (teamCount <= 2) return ['Championship'];
  if (teamCount <= 4) return ['Semifinals', 'Championship'];
  if (teamCount <= 6) return ['Play-In', 'Semifinals', 'Championship'];
  if (teamCount <= 8) return ['Quarterfinals', 'Semifinals', 'Championship'];
  return ['Play-In', 'Quarterfinals', 'Semifinals', 'Championship'];
}

export async function loadBracket(): Promise<BracketData | null> {
  const supabase = createServiceClient();

  const { data: season } = await supabase
    .from('seasons')
    .select('id, year')
    .in('status', ['active', 'drafting', 'playoffs', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
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

export async function saveBracket(data: BracketData): Promise<void> {
  const supabase = createServiceClient();

  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .in('status', ['active', 'drafting', 'playoffs', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!season) throw new Error('No current season found');

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

export function computeBracketStatus(matchups: BracketMatchup[]): 'pending' | 'in_progress' | 'complete' {
  const hasAnyResult = matchups.some((m) => m.winningSeed !== null);
  const finalMatch = matchups.find((m) => m.id === 'FINAL');
  const isComplete = finalMatch?.winningSeed !== null;

  if (isComplete) return 'complete';
  if (hasAnyResult) return 'in_progress';
  return 'pending';
}

export async function getQualifierCount(): Promise<number> {
  const [leagues, championship] = await Promise.all([
    getSeasonLeagues(),
    getChampionshipConfig(),
  ]);
  return leagues.length * championship.qualifiersPerLeague;
}
