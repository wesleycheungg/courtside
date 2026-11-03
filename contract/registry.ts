/**
 * The schemas under contract.
 *
 * One entry per ESPN endpoint the proxy calls. Adding an endpoint to `api/`
 * means adding it here too, which is the point: the snapshot test fails on an
 * endpoint with no committed snapshot, so a new upstream dependency cannot
 * arrive unwatched.
 */

import {
  espnAthleteSchema,
  espnGameLogSchema,
  espnScoreboardSchema,
  espnStandingsSchema,
  espnSummarySchema,
  espnTeamsSchema,
} from '../src/data/espn/espnSchemas';

export const contractSchemas = {
  athlete: espnAthleteSchema,
  gamelog: espnGameLogSchema,
  scoreboard: espnScoreboardSchema,
  standings: espnStandingsSchema,
  summary: espnSummarySchema,
  teams: espnTeamsSchema,
};

export type ContractSchemaName = keyof typeof contractSchemas;

export const contractSchemaNames = Object.keys(contractSchemas).sort() as [
  ContractSchemaName,
  ...ContractSchemaName[],
];
