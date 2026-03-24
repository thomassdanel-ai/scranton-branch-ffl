export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
  };
}

export interface SleeperRosterSettings {
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  fpts_decimal: number;
  fpts_against: number;
  fpts_against_decimal: number;
  total_moves: number;
  waiver_position: number;
  waiver_budget_used: number;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[];
  starters: string[];
  reserve: string[] | null;
  settings: SleeperRosterSettings;
  metadata?: {
    streak?: string;
    record?: string;
  };
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  custom_points: number | null;
  starters: string[];
  players: string[];
  starters_points: number[];
  players_points: Record<string, number>;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: 'trade' | 'waiver' | 'free_agent';
  status: 'complete' | 'failed' | 'pending';
  created: number;
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  roster_ids: number[];
  creator: string;
  leg: number;
  draft_picks: SleeperTradedPick[];
  waiver_budget: Array<{ sender: number; receiver: number; amount: number }>;
  consenter_ids: string[];
  metadata?: Record<string, string>;
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
  sport: string;
  total_rosters: number;
  settings: Record<string, number>;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  avatar: string | null;
}

export interface SleeperNFLState {
  week: number;
  season_type: 'pre' | 'regular' | 'post';
  season: string;
  display_week: number;
  season_start_date: string;
  previous_season: string;
  league_create_season: string;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: string;
  team: string | null;
  status: string;
  age?: number;
  fantasy_positions?: string[];
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  status: string;
  type: string;
  season: string;
  settings: Record<string, number>;
  created: number;
  updated: number;
}

export interface SleeperDraftPick {
  round: number;
  roster_id: number;
  player_id: string;
  picked_by: string;
  pick_no: number;
  metadata: {
    first_name: string;
    last_name: string;
    position: string;
    team: string;
    slot_name: string;
    years_exp: string;
    number: string;
    sport: string;
  };
}
