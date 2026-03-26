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
