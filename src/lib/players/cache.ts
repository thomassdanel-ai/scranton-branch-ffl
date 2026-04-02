import { getAllPlayers } from '@/lib/sleeper/api';
import { createServiceClient } from '@/lib/supabase/server';

export type PlayerInfo = {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
};

type PlayerLookup = Record<string, PlayerInfo>;

let memoryCache: PlayerLookup | null = null;
let memoryCacheTime = 0;
const MEMORY_TTL = 1000 * 60 * 10; // 10 min in-memory cache

/**
 * Get a player lookup map. Tries in order:
 * 1. In-memory cache (10 min)
 * 2. Supabase players_normalized table (instant per-row lookups)
 * 3. Fresh fetch from Sleeper API (populates players_normalized)
 */
export async function getPlayerLookup(): Promise<PlayerLookup> {
  // 1. Memory cache
  if (memoryCache && Date.now() - memoryCacheTime < MEMORY_TTL) {
    return memoryCache;
  }

  // 2. Supabase normalized table
  try {
    const supabase = createServiceClient();
    const { data, count } = await supabase
      .from('players_normalized')
      .select('player_id, full_name, position, team', { count: 'exact', head: true });

    // Only use if table has data
    if (count && count > 0) {
      const { data: players } = await supabase
        .from('players_normalized')
        .select('player_id, full_name, position, team');

      if (players && players.length > 0) {
        const lookup: PlayerLookup = {};
        for (const p of players) {
          lookup[p.player_id] = {
            player_id: p.player_id,
            full_name: p.full_name,
            position: p.position ?? 'Unknown',
            team: p.team ?? null,
          };
        }
        memoryCache = lookup;
        memoryCacheTime = Date.now();
        return lookup;
      }
    }
  } catch {
    // Table may not exist yet — continue to fresh fetch
  }

  // 3. Fresh fetch
  return refreshPlayerCache();
}

/**
 * Fetch all players from Sleeper and upsert into players_normalized.
 */
export async function refreshPlayerCache(): Promise<PlayerLookup> {
  const raw = await getAllPlayers();
  const lookup: PlayerLookup = {};
  const rows: Array<{
    player_id: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    team: string | null;
    status: string | null;
    updated_at: string;
  }> = [];

  const now = new Date().toISOString();

  for (const id of Object.keys(raw)) {
    const p = raw[id];
    const fullName = p.full_name ?? `${p.first_name} ${p.last_name}`;

    lookup[id] = {
      player_id: id,
      full_name: fullName,
      position: p.position ?? 'Unknown',
      team: p.team ?? null,
    };

    rows.push({
      player_id: id,
      full_name: fullName,
      first_name: p.first_name ?? null,
      last_name: p.last_name ?? null,
      position: p.position ?? null,
      team: p.team ?? null,
      status: p.status ?? null,
      updated_at: now,
    });
  }

  // Upsert into players_normalized in batches
  try {
    const supabase = createServiceClient();
    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await supabase
        .from('players_normalized')
        .upsert(batch, { onConflict: 'player_id' });
    }
  } catch {
    // Non-fatal — we still have the data in memory
  }

  memoryCache = lookup;
  memoryCacheTime = Date.now();
  return lookup;
}

/**
 * Resolve a player ID to a display name.
 */
export function formatPlayer(playerId: string, lookup: PlayerLookup): string {
  const player = lookup[playerId];
  if (!player) return `#${playerId}`;
  const team = player.team ? ` (${player.team})` : '';
  return `${player.full_name}${team}`;
}

/**
 * Resolve a player ID to name + position.
 */
export function formatPlayerWithPosition(playerId: string, lookup: PlayerLookup): { name: string; position: string; team: string | null } {
  const player = lookup[playerId];
  if (!player) return { name: `#${playerId}`, position: '??', team: null };
  return {
    name: player.full_name,
    position: player.position,
    team: player.team,
  };
}
