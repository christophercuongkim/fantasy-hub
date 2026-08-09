import {
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
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
    playerId: uuid().references(() => players.id), // null until the crosswalk resolves it
    // Raw snapshot of who was drafted, from Yahoo (or the bootstrap import).
    // Preserved even before the crosswalk exists so draft history is never lost.
    playerName: text(),
    playerKey: text(), // Yahoo player key, if known
    cost: integer(), // auction dollars; null in snake drafts
    adpAtTime: numeric({ precision: 5, scale: 1 }), // FantasyPros consensus ADP at draft date
    reachDelta: numeric({ precision: 5, scale: 1 }), // adp_at_time - overall; positive = reached
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.season, t.overall] })],
);

// Preseason draft value board for a league-season — computed (not scraped) by
// the api's build-draft-board job from projections + the draft-prior curve, and
// read by the draft assistant. Season value is expected points over replacement
// (VOR) for THIS league's scoring + roster; adp is the market column shown beside
// it. Rebuilt idempotently per (league, season, player).
export const draftBoard = pgTable(
  "draft_board",
  {
    leagueId: uuid()
      .notNull()
      .references(() => leagues.id),
    season: integer().notNull(),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    expectedPpg: numeric({ precision: 6, scale: 2 }).notNull(), // per-game
    seasonPts: numeric({ precision: 6, scale: 1 }).notNull(), // ppg × games
    vor: numeric({ precision: 6, scale: 1 }).notNull(), // value over replacement
    posRank: integer().notNull(), // 1 = best at the position
    overallRank: integer().notNull(), // 1 = best by VOR across positions
    tier: integer().notNull(), // positional tier from VOR gaps (1 = top)
    adp: numeric({ precision: 5, scale: 1 }), // market ADP; null if unranked
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.season, t.playerId] })],
);
