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

// Retry transient failures (429 rate-limit, 5xx server errors, network) with
// exponential backoff + jitter. 4xx client errors (except 429) are returned
// immediately — retrying a 404 is pointless and wastes budget.
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

async function sleeperFetch<T>(path: string, fresh = false): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const init: RequestInit = fresh
    ? { cache: 'no-store' }
    : { next: { revalidate: 300 } };

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);

      if (res.ok) {
        return (await res.json()) as T;
      }

      // Non-retryable HTTP error — bail immediately.
      if (!shouldRetry(res.status)) {
        throw new Error(`Sleeper API error: ${res.status} ${path}`);
      }

      // Retryable — honor Retry-After if provided, else exponential backoff + jitter.
      lastErr = new Error(`Sleeper API error: ${res.status} ${path}`);
      if (attempt === MAX_RETRIES) break;

      const retryAfter = res.headers.get('retry-after');
      const retryAfterMs = retryAfter ? Math.min(Number(retryAfter) * 1000, 10_000) : NaN;
      const backoff = Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      await sleep(backoff);
    } catch (err) {
      // Network-level failure (fetch threw). Retry the same way.
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES) break;
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      await sleep(backoff);
    }
  }

  throw lastErr ?? new Error(`Sleeper API error (unknown): ${path}`);
}

export async function getNFLState(): Promise<SleeperNFLState> {
  return sleeperFetch<SleeperNFLState>('/state/nfl');
}

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`);
}

export async function getLeagueUsers(leagueId: string, fresh = false): Promise<SleeperUser[]> {
  return sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`, fresh);
}

export async function getLeagueRosters(leagueId: string, fresh = false): Promise<SleeperRoster[]> {
  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`, fresh);
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
