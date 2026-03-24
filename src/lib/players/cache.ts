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
 * 2. Supabase players_cache table
 * 3. Fresh fetch from Sleeper API (and stores in Supabase)
 */
export async function getPlayerLookup(): Promise<PlayerLookup> {
  // 1. Memory cache
  if (memoryCache && Date.now() - memoryCacheTime < MEMORY_TTL) {
    return memoryCache;
  }

  // 2. Supabase cache
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('players_cache')
      .select('data, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.data) {
      const age = Date.now() - new Date(data.fetched_at).getTime();
      // Use if less than 24 hours old
      if (age < 1000 * 60 * 60 * 24) {
        memoryCache = data.data as PlayerLookup;
        memoryCacheTime = Date.now();
        return memoryCache;
      }
    }
  } catch {
    // Supabase unavailable — continue to fresh fetch
  }

  // 3. Fresh fetch
  return refreshPlayerCache();
}

/**
 * Fetch all players from Sleeper and store in Supabase.
 */
export async function refreshPlayerCache(): Promise<PlayerLookup> {
  const raw = await getAllPlayers();
  const lookup: PlayerLookup = {};

  for (const id of Object.keys(raw)) {
    const p = raw[id];
    lookup[id] = {
      player_id: id,
      full_name: p.full_name ?? `${p.first_name} ${p.last_name}`,
      position: p.position ?? 'Unknown',
      team: p.team ?? null,
    };
  }

  // Store in Supabase
  try {
    const supabase = createServiceClient();
    await supabase.from('players_cache').insert({
      data: lookup,
      fetched_at: new Date().toISOString(),
    });
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
