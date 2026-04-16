import { z } from 'zod';

/**
 * Zod schemas for bracket data validation.
 * Used on bracket PUT/generate endpoints to ensure data integrity.
 */

// Upper bounds keep payloads bounded and reject obviously-junk data.
// We allow a bit of headroom over realistic values so legitimate data is never
// rejected (e.g., max 20 teams for future 4-division brackets, 30 max weeks
// accounts for any possible NFL season extension).
export const BracketTeamSchema = z.object({
  rosterId: z.number().int().positive().max(1_000),
  leagueId: z.string().min(1).max(64),
  leagueName: z.string().min(1).max(200),
  leagueColor: z.string().min(1).max(32),
  teamName: z.string().min(1).max(200),
  displayName: z.string().min(1).max(200),
  avatar: z.string().max(256).nullable(),
  wins: z.number().int().min(0).max(30),
  losses: z.number().int().min(0).max(30),
  pointsFor: z.number().min(0).max(10_000),
  seed: z.number().int().positive().max(20),
});

export const BracketMatchupSchema = z.object({
  id: z.string().min(1).max(64),
  round: z.number().int().positive().max(5),
  position: z.number().int().min(0).max(20),
  team1Seed: z.number().int().positive().max(20).nullable(),
  team2Seed: z.number().int().positive().max(20).nullable(),
  team1Score: z.number().min(-10).max(10_000).nullable(),
  team2Score: z.number().min(-10).max(10_000).nullable(),
  winningSeed: z.number().int().positive().max(20).nullable(),
  label: z.string().min(1).max(100),
});

export const BracketDataSchema = z.object({
  seasonYear: z.string().min(4).max(10),
  teams: z.array(BracketTeamSchema).min(2).max(16),
  matchups: z.array(BracketMatchupSchema).min(1).max(64),
  rounds: z.number().int().positive().max(5),
  status: z.enum(['pending', 'in_progress', 'complete']),
  champion: BracketTeamSchema.nullable(),
  playoffStartWeek: z.number().int().positive().max(30).optional(),
});

export type ValidatedBracketData = z.infer<typeof BracketDataSchema>;
