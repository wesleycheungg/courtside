/**
 * Zod schemas for ESPN's unofficial endpoints.
 *
 * Written against real responses captured in ./fixtures — see that folder's
 * README for the shapes that are not obvious. These run at the proxy boundary,
 * so a shape change upstream produces a logged field path instead of an
 * undefined deep in a component.
 *
 * Deliberately permissive about fields we do not read: ESPN adds keys often,
 * and failing on an unknown key would turn every upstream addition into an
 * outage. Fields we *do* read are strict.
 */

import { z } from 'zod';

/** ESPN sends hex without a leading '#', and occasionally omits it entirely. */
const hexColor = z.string().regex(/^[0-9a-fA-F]{6}$/);

export const espnStatusSchema = z.object({
  // The scoreboard sends both; the summary header sends neither, carrying only
  // `type`. The normalizer derives the period from the line scores instead.
  period: z.number().int().nonnegative().optional(),
  displayClock: z.string().optional(),
  type: z.object({
    // The one field we branch on. Everything else about an in-progress game's
    // status block is unobserved, so nothing else here is constrained.
    state: z.enum(['pre', 'in', 'post']),
    completed: z.boolean(),
    description: z.string().optional(),
    detail: z.string().optional(),
    shortDetail: z.string().optional(),
  }),
});

export const espnTeamSchema = z.object({
  id: z.string(),
  abbreviation: z.string(),
  displayName: z.string(),
  shortDisplayName: z.string().optional(),
  name: z.string().optional(),
  location: z.string().optional(),
  color: hexColor.optional(),
  alternateColor: hexColor.optional(),
  logo: z.string().optional(),
});

/**
 * The same concept in two shapes: the scoreboard sends `{ value, period }`
 * while the summary header sends `{ displayValue }` only. Read both through
 * `lineScoreValue` rather than touching either field directly.
 */
export const espnLineScoreSchema = z.object({
  value: z.number().optional(),
  displayValue: z.string().optional(),
  period: z.number().int().positive().optional(),
});

export const espnRecordSchema = z.object({
  type: z.string(),
  summary: z.string(),
});

export const espnCompetitorSchema = z.object({
  id: z.string(),
  homeAway: z.enum(['home', 'away']),
  winner: z.boolean().optional(),
  // A string on the wire: "117", and "0" before tip-off.
  score: z.string().optional(),
  team: espnTeamSchema,
  // Absent entirely on a scheduled game.
  linescores: z.array(espnLineScoreSchema).optional(),
  // Plural on the scoreboard, singular on the summary header.
  records: z.array(espnRecordSchema).optional(),
  record: z.array(espnRecordSchema).optional(),
});

export const espnCompetitionSchema = z.object({
  id: z.string(),
  date: z.string(),
  status: espnStatusSchema,
  competitors: z.array(espnCompetitorSchema).min(2),
});

export const espnEventSchema = z.object({
  id: z.string(),
  date: z.string(),
  shortName: z.string().optional(),
  competitions: z.array(espnCompetitionSchema).min(1),
});

export const espnScoreboardSchema = z.object({
  events: z.array(espnEventSchema),
});

/** Standings stats are a flat bag; every lookup must tolerate an absent entry. */
export const espnStatSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  value: z.number().optional(),
  displayValue: z.string().optional(),
});

export const espnStandingsEntrySchema = z.object({
  team: espnTeamSchema,
  stats: z.array(espnStatSchema),
});

export const espnStandingsSchema = z.object({
  children: z
    .array(
      z.object({
        name: z.string(),
        abbreviation: z.string().optional(),
        standings: z.object({
          entries: z.array(espnStandingsEntrySchema),
        }),
      }),
    )
    .min(1),
});

export const espnTeamsSchema = z.object({
  sports: z
    .array(
      z.object({
        leagues: z
          .array(z.object({ teams: z.array(z.object({ team: espnTeamSchema })) }))
          .min(1),
      }),
    )
    .min(1),
});

export type EspnScoreboard = z.infer<typeof espnScoreboardSchema>;
export type EspnEvent = z.infer<typeof espnEventSchema>;
export type EspnCompetitor = z.infer<typeof espnCompetitorSchema>;
export type EspnStandings = z.infer<typeof espnStandingsSchema>;
export type EspnStandingsEntry = z.infer<typeof espnStandingsEntrySchema>;
export type EspnTeams = z.infer<typeof espnTeamsSchema>;
export type EspnTeam = z.infer<typeof espnTeamSchema>;

/* ── summary ──────────────────────────────────────────────────────────────── */

export const espnTeamStatSchema = z.object({
  name: z.string(),
  displayValue: z.string(),
  label: z.string().optional(),
  abbreviation: z.string().optional(),
});

export const espnBoxscoreTeamSchema = z.object({
  team: espnTeamSchema,
  homeAway: z.enum(['home', 'away']).optional(),
  statistics: z.array(espnTeamStatSchema),
});

/**
 * Player stats arrive as parallel arrays: `labels` names the columns and each
 * athlete's `stats` holds the values in that order, all as strings.
 */
export const espnPlayerGroupSchema = z.object({
  team: espnTeamSchema,
  statistics: z.array(
    z.object({
      labels: z.array(z.string()),
      athletes: z.array(
        z.object({
          athlete: z.object({
            id: z.string(),
            displayName: z.string(),
            shortName: z.string().optional(),
            position: z.object({ abbreviation: z.string().optional() }).optional(),
          }),
          stats: z.array(z.string()),
          starter: z.boolean().optional(),
          didNotPlay: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

export const espnPlaySchema = z.object({
  id: z.string(),
  text: z.string().optional(),
  scoringPlay: z.boolean().optional(),
  awayScore: z.number(),
  homeScore: z.number(),
  period: z.object({ number: z.number().int() }),
  clock: z.object({ displayValue: z.string() }),
  // Absent on game-level events such as "End of Game".
  team: z.object({ id: z.string() }).optional(),
});

export const espnSummarySchema = z.object({
  header: z.object({
    id: z.string(),
    competitions: z.array(espnCompetitionSchema).min(1),
  }),
  boxscore: z
    .object({
      teams: z.array(espnBoxscoreTeamSchema).optional(),
      players: z.array(espnPlayerGroupSchema).optional(),
    })
    .optional(),
  plays: z.array(espnPlaySchema).optional(),
});

export type EspnSummary = z.infer<typeof espnSummarySchema>;
export type EspnPlayerGroup = z.infer<typeof espnPlayerGroupSchema>;
export type EspnBoxscoreTeam = z.infer<typeof espnBoxscoreTeamSchema>;
