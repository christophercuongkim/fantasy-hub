import { integer, numeric, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { leagueTeams, leagues } from "./league";
import { players } from "./identity";

// Every pick from every season the league has existed. Snapshotted in Phase 1
// (Yahoo history can vanish if the league is recreated).
export const draftPicks = pgTable(
  "draft_picks",
  {
    leagueId: uuid()
      .notNull()
      .references(() => leagues.id),
    season: integer().notNull(),
    overall: integer().notNull(),
    round: integer().notNull(),
    pickInRound: integer().notNull(),
    leagueTeamId: uuid()
      .notNull()
      .references(() => leagueTeams.id),
    playerId: uuid().references(() => players.id), // null if unmatched
    cost: integer(), // auction dollars; null in snake drafts
    adpAtTime: numeric({ precision: 5, scale: 1 }), // FantasyPros consensus ADP at draft date
    reachDelta: numeric({ precision: 5, scale: 1 }), // adp_at_time - overall; positive = reached
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.season, t.overall] })],
);
