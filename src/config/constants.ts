// Org-level constants (never change per season)
export const ORG_NAME = 'Scranton Branch Fantasy Football League';
export const ORG_SHORT_NAME = 'Scranton Branch FFL';
export const COMMISSIONER_SLEEPER_ID = '739591965980643328';

// Default league palette — assigned by position during season setup
export const DEFAULT_LEAGUE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
export const DEFAULT_LEAGUE_NAMES = ['Sales', 'Accounting', 'Warehouse', 'HR'];
export const DEFAULT_LEAGUE_SHORT_NAMES = ['Sales', 'Acct', 'Whse', 'HR'];

// Championship defaults — stored per-season in seasons.settings
export const DEFAULT_CHAMPIONSHIP = {
  qualifiersPerLeague: 3,
  format: 'bracket' as const,
};

// Season status lifecycle:
// setup → registering → confirming → pre_draft → drafting → active → playoffs → completed → archived
export const VALID_SEASON_STATUSES = [
  'setup',
  'registering',
  'confirming',
  'pre_draft',
  'drafting',
  'active',
  'playoffs',
  'completed',
  'archived',
] as const;

export type SeasonStatusValue = (typeof VALID_SEASON_STATUSES)[number];

// Valid transitions: each status maps to the statuses it can move to
export const SEASON_STATUS_TRANSITIONS: Record<SeasonStatusValue, SeasonStatusValue[]> = {
  setup: ['registering', 'pre_draft'],
  registering: ['confirming', 'pre_draft'],
  confirming: ['pre_draft'],
  pre_draft: ['drafting'],
  drafting: ['active'],
  active: ['playoffs'],
  playoffs: ['completed'],
  completed: ['archived'],
  archived: [],
};
