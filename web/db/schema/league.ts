import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { acquiredViaEnum, rosterSlotEnum, waiverTypeEnum } from "./enums";
import { players } from "./identity";
import type { RosterPositions, ScoringJson } from "./types";

export const leagues = pgTable("leagues", {
  id: uuid().primaryKey().defaultRandom(),
  yahooLeagueKey: text().notNull().unique(), // {game_key}.l.{league_id}
  name: text().notNull(),
  season: integer().notNull(),
  numTeams: integer().notNull(),
  scoringJson: jsonb().$type<ScoringJson>().notNull(),
  rosterPositionsJson: jsonb().$type<RosterPositions>().notNull(),
  playoffStartWeek: integer().notNull(),
  numPlayoffTeams: integer().notNull(),
  waiverType: waiverTypeEnum(),
  tradeDeadline: date(), // suppress trade suggestions after this
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const leagueTeams = pgTable("league_teams", {
  id: uuid().primaryKey().defaultRandom(),
  leagueId: uuid()
    .notNull()
    .references(() => leagues.id),
  yahooTeamKey: text().notNull(), // {league_key}.t.{team_id}
  name: text().notNull(), // manager-chosen, changes freely
  managerName: text(), // more stable than name; key tendency profiles off this
  isMine: boolean().notNull().default(false), // exactly one true per league
  draftPosition: integer(),
});

// Snapshot of who was rostered, by week. One row per player per team per week.
export const rosters = pgTable(
  "rosters",
  {
    leagueTeamId: uuid()
      .notNull()
      .references(() => leagueTeams.id),
    week: integer().notNull(),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    slot: rosterSlotEnum().notNull(),
    isStarter: boolean().notNull(), // slot NOT IN ('BN','IR')
    acquiredVia: acquiredViaEnum(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.leagueTeamId, t.week, t.playerId] })],
);

// Store each matchup once with canonical ordering (lower team UUID as team_a).
export const matchups = pgTable(
  "matchups",
  {
    leagueId: uuid()
      .notNull()
      .references(() => leagues.id),
    week: integer().notNull(),
    teamAId: uuid()
      .notNull()
      .references(() => leagueTeams.id),
    teamBId: uuid()
      .notNull()
      .references(() => leagueTeams.id),
    teamAScore: numeric({ precision: 6, scale: 2 }), // null until played
    teamBScore: numeric({ precision: 6, scale: 2 }),
    isPlayoff: boolean().notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.week, t.teamAId] })],
);
