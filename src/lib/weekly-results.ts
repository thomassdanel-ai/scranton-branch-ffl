import type { SleeperMatchup, SleeperRoster } from '@/lib/sleeper/types';

export function buildWeeklyResults(
  seasonId: string,
  leagueId: string,
  week: number,
  matchups: SleeperMatchup[],
  rosters: SleeperRoster[]
) {
  const grouped: Record<number, SleeperMatchup[]> = {};
  for (const m of matchups) {
    if (!m.matchup_id) continue;
    if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
    grouped[m.matchup_id].push(m);
  }

  const rosterMap: Record<number, SleeperRoster> = {};
  for (const r of rosters) {
    rosterMap[r.roster_id] = r;
  }

  const rows: Array<Record<string, unknown>> = [];

  for (const matchupId of Object.keys(grouped)) {
    const sides = grouped[Number(matchupId)];
    for (const side of sides) {
      const opponent = sides.find((s) => s.roster_id !== side.roster_id);
      const roster = rosterMap[side.roster_id];

      let result: string | null = null;
      if (opponent) {
        if (side.points > opponent.points) result = 'win';
        else if (side.points < opponent.points) result = 'loss';
        else result = 'tie';
      }

      const pf = roster
        ? roster.settings.fpts + (roster.settings.fpts_decimal ?? 0) / 100
        : 0;
      const pa = roster
        ? roster.settings.fpts_against + (roster.settings.fpts_against_decimal ?? 0) / 100
        : 0;

      rows.push({
        season_id: seasonId,
        league_id: leagueId,
        week,
        roster_id: side.roster_id,
        points: side.points ?? 0,
        opponent_roster_id: opponent?.roster_id ?? null,
        opponent_points: opponent?.points ?? null,
        result,
        matchup_id: Number(matchupId),
        season_wins: roster?.settings.wins ?? 0,
        season_losses: roster?.settings.losses ?? 0,
        season_ties: roster?.settings.ties ?? 0,
        season_points_for: pf,
        season_points_against: pa,
        streak: roster?.metadata?.streak ?? null,
        is_playoff: false,
        is_bracket: false,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  return rows;
}

/**
 * Build per-player score rows from matchup data.
 * Includes both starters (with slot position) and bench players.
 */
export function buildPlayerScores(
  seasonId: string,
  leagueId: string,
  week: number,
  matchups: SleeperMatchup[],
  rosterPositions: string[]
) {
  const rows: Array<Record<string, unknown>> = [];
  const now = new Date().toISOString();

  for (const m of matchups) {
    if (!m.matchup_id) continue;
    const starterSet = new Set(m.starters ?? []);

    // Starters — map to slot positions
    if (m.starters) {
      for (let i = 0; i < m.starters.length; i++) {
        const playerId = m.starters[i];
        if (playerId === '0') continue; // empty slot
        rows.push({
          season_id: seasonId,
          league_id: leagueId,
          week,
          roster_id: m.roster_id,
          player_id: playerId,
          points: m.starters_points?.[i] ?? m.players_points?.[playerId] ?? 0,
          is_starter: true,
          slot_position: rosterPositions[i] ?? 'FLEX',
          fetched_at: now,
        });
      }
    }

    // Bench — players on roster but not in starters
    if (m.players) {
      for (const playerId of m.players) {
        if (starterSet.has(playerId)) continue;
        if (playerId === '0') continue;
        rows.push({
          season_id: seasonId,
          league_id: leagueId,
          week,
          roster_id: m.roster_id,
          player_id: playerId,
          points: m.players_points?.[playerId] ?? 0,
          is_starter: false,
          slot_position: 'BN',
          fetched_at: now,
        });
      }
    }
  }

  return rows;
}
