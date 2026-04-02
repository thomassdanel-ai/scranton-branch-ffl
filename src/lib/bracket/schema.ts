import { z } from 'zod';

/**
 * Zod schemas for bracket data validation.
 * Used on bracket PUT/generate endpoints to ensure data integrity.
 */

export const BracketTeamSchema = z.object({
  rosterId: z.number().int().positive(),
  leagueId: z.string().min(1),
  leagueName: z.string().min(1),
  leagueColor: z.string().min(1),
  teamName: z.string().min(1),
  displayName: z.string().min(1),
  avatar: z.string().nullable(),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  pointsFor: z.number().min(0),
  seed: z.number().int().positive(),
});

export const BracketMatchupSchema = z.object({
  id: z.string().min(1),
  round: z.number().int().positive(),
  position: z.number().int().min(0),
  team1Seed: z.number().int().positive().nullable(),
  team2Seed: z.number().int().positive().nullable(),
  team1Score: z.number().nullable(),
  team2Score: z.number().nullable(),
  winningSeed: z.number().int().positive().nullable(),
  label: z.string().min(1),
});

export const BracketDataSchema = z.object({
  seasonYear: z.string().min(4),
  teams: z.array(BracketTeamSchema).min(2).max(16),
  matchups: z.array(BracketMatchupSchema).min(1),
  rounds: z.number().int().positive().max(5),
  status: z.enum(['pending', 'in_progress', 'complete']),
  champion: BracketTeamSchema.nullable(),
  playoffStartWeek: z.number().int().positive().optional(),
});

export type ValidatedBracketData = z.infer<typeof BracketDataSchema>;
