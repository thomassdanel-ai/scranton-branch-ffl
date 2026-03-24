import type {
  SleeperUser,
  SleeperRoster,
  SleeperMatchup,
  SleeperTransaction,
  SleeperLeague,
  SleeperNFLState,
  SleeperPlayer,
  SleeperDraft,
  SleeperDraftPick,
  SleeperTradedPick,
} from './types';

const BASE_URL = 'https://api.sleeper.app/v1';

async function sleeperFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Sleeper API error: ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function getNFLState(): Promise<SleeperNFLState> {
  return sleeperFetch<SleeperNFLState>('/state/nfl');
}

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`);
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  return sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`);
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`);
}

export async function getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return sleeperFetch<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`);
}

export async function getTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]> {
  return sleeperFetch<SleeperTransaction[]>(`/league/${leagueId}/transactions/${week}`);
}

export async function getTradedPicks(leagueId: string): Promise<SleeperTradedPick[]> {
  return sleeperFetch<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`);
}

export async function getLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`);
}

export async function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`);
}

export async function getUser(userId: string): Promise<SleeperUser> {
  return sleeperFetch<SleeperUser>(`/user/${userId}`);
}

export async function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  return sleeperFetch<Record<string, SleeperPlayer>>('/players/nfl');
}

export async function getTrendingPlayers(type: 'add' | 'drop', limit = 25): Promise<Array<{ player_id: string; count: number }>> {
  return sleeperFetch(`/players/nfl/trending/${type}?limit=${limit}`);
}

export function getAvatarUrl(avatarId: string | null, thumb = false): string | null {
  if (!avatarId) return null;
  return thumb
    ? `https://sleepercdn.com/avatars/thumbs/${avatarId}`
    : `https://sleepercdn.com/avatars/${avatarId}`;
}
