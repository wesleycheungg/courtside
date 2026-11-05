/**
 * Zod schemas for the domain types.
 *
 * In M1 these validate the mock fixtures, which proves the fixtures actually
 * match the types the UI is written against. From M2 they also run at the proxy
 * boundary, where a failure is logged with the field path that broke.
 */

import { z } from 'zod';

export const leagueIdSchema = z.enum(['nba']);

export const teamRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  abbreviation: z.string().min(2).max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a 6-digit hex color'),
  logoUrl: z.string().url().optional(),
  record: z.string().optional(),
});

export const periodSchema = z.object({
  number: z.number().int().positive(),
  label: z.string().min(1),
  awayScore: z.number().int().nonnegative(),
  homeScore: z.number().int().nonnegative(),
});

export const gameStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('scheduled'),
    tipoff: z.string().min(1),
  }),
  z.object({
    status: z.literal('live'),
    periodNumber: z.number().int().positive(),
    periodLabel: z.string().min(1),
    clock: z.string(),
  }),
  z.object({
    status: z.literal('final'),
    wentToOvertime: z.boolean(),
  }),
]);

export const gameSchema = z.object({
  id: z.string().min(1),
  league: leagueIdSchema,
  startsAt: z.iso.datetime(),
  state: gameStateSchema,
  away: teamRefSchema,
  home: teamRefSchema,
  awayScore: z.number().int().nonnegative(),
  homeScore: z.number().int().nonnegative(),
});

export const teamStatSchema = z.object({
  label: z.string().min(1),
  awayValue: z.string().min(1),
  homeValue: z.string().min(1),
  awayShare: z.number().min(0).max(1),
});

export const playerStatLineSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  position: z.string().min(1),
  minutes: z.number().nonnegative(),
  points: z.number().int().nonnegative(),
  rebounds: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  fieldGoalsMade: z.number().int().nonnegative(),
  fieldGoalsAttempted: z.number().int().nonnegative(),
  plusMinus: z.number().int().optional(),
});

export const boxScoreSchema = z.object({
  away: z.array(playerStatLineSchema),
  home: z.array(playerStatLineSchema),
});

export const statLeaderSchema = z.object({
  stat: z.enum(['points', 'rebounds', 'assists']),
  away: playerStatLineSchema,
  home: playerStatLineSchema,
});

export const gameDetailSchema = gameSchema.extend({
  periods: z.array(periodSchema),
  teamStats: z.array(teamStatSchema),
  boxScore: boxScoreSchema,
  topPerformers: z.array(playerStatLineSchema),
  statLeaders: z.array(statLeaderSchema),
});

export const playEventSchema = z.object({
  id: z.string().min(1),
  periodNumber: z.number().int().positive(),
  clock: z.string(),
  teamId: z.string().min(1).optional(),
  description: z.string().min(1),
  isScoringPlay: z.boolean(),
  awayScore: z.number().int().nonnegative(),
  homeScore: z.number().int().nonnegative(),
});

export const standingSchema = z.object({
  rank: z.number().int().positive(),
  team: teamRefSchema,
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  winPercent: z.number().min(0).max(1),
  gamesBehind: z.number().nonnegative(),
  streak: z.string().min(1),
});

export const conferenceSchema = z.object({
  id: z.enum(['east', 'west']),
  name: z.string().min(1),
  standings: z.array(standingSchema),
});

export const statTileSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  rank: z.number().int().positive().optional(),
});

export const seasonAveragesSchema = z.object({
  points: z.number().nonnegative(),
  rebounds: z.number().nonnegative(),
  assists: z.number().nonnegative(),
  fieldGoalPercent: z.number().min(0).max(100),
});

export const rosterEntrySchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  position: z.string().min(1),
  jerseyNumber: z.string(),
  seasonAverages: seasonAveragesSchema.optional(),
});

export const shootingSplitSchema = z.object({
  label: z.string().min(1),
  made: z.number().int().nonnegative(),
  attempted: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
});

export const gameLogEntrySchema = z.object({
  gameId: z.string().min(1),
  opponentAbbreviation: z.string().min(2).max(4),
  isHome: z.boolean(),
  result: z.string().min(1),
  points: z.number().int().nonnegative(),
  rebounds: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  fieldGoalsMade: z.number().int().nonnegative(),
  fieldGoalsAttempted: z.number().int().nonnegative(),
});

export const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  teamColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: z.string().min(1),
  jerseyNumber: z.string(),
  height: z.string(),
  age: z.number().int().positive(),
  seasonNumber: z.number().int().positive(),
  seasonAverages: z.array(statTileSchema),
  shootingSplits: z.array(shootingSplitSchema),
  gameLog: z.array(gameLogEntrySchema),
});

/**
 * Parse with a label so a failure says which payload broke and where, rather
 * than just throwing a bare ZodError. This is what the M2 proxy will log.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`${label} failed schema validation — ${issues}`);
  }
  return result.data;
}
