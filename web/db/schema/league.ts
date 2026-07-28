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
import {
  acquiredViaEnum,
  claimStatusEnum,
  rosterSlotEnum,
  sportEnum,
  waiverTypeEnum,
} from "./enums";
import { leagueFamilies, managers } from "./families";
import { players } from "./identity";
import type { RosterPositions, ScoringJson } from "./types";

// One row per (family, season): Yahoo mints a new league_key each season, so a
// 12-year league is 12 rows sharing a family_id. Scoring/roster live here since
// they're per-season (and per-sport).
export const leagues = pgTable("leagues", {
  id: uuid().primaryKey().defaultRandom(),
  familyId: uuid()
    .notNull()
    .references(() => leagueFamilies.id),
  sport: sportEnum().notNull(), // immutable per family; denormalized for filtering
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
  // The canonical person. NULL = unclaimed (hidden pre-membership seasons whose
  // managers Yahoo won't reveal); resolved later via an approved team_claim.
  managerId: uuid().references(() => managers.id),
  yahooTeamKey: text(), // {league_key}.t.{team_id}; null when bootstrap lacks it
  name: text().notNull(), // vanity team name, per season; changes freely
  isMine: boolean().notNull().default(false), // exactly one true per league
  draftPosition: integer(),
});

// A member claims a historical unclaimed team as theirs; the admin (Chris)
// approves, which sets that league_team's manager_id. See id_crosswalk_log for
// the sibling review-queue pattern.
export const teamClaims = pgTable("team_claims", {
  id: uuid().primaryKey().defaultRandom(),
  leagueTeamId: uuid()
    .notNull()
    .references(() => leagueTeams.id),
  claimantManagerId: uuid()
    .notNull()
    .references(() => managers.id),
  status: claimStatusEnum().notNull().default("pending"),
  reviewedBy: text(), // admin identifier; null until reviewed
  reviewedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
