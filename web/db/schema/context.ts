import {
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  practiceStatusEnum,
  reportStatusEnum,
  roofEnum,
  yahooInjuryStatusEnum,
} from "./enums";
import { players } from "./identity";

// Current + upcoming weeks in Postgres; full history in Parquet.
export const schedule = pgTable(
  "schedule",
  {
    gameId: text().primaryKey(), // format 2025_01_KC_BAL, globally unique
    season: integer().notNull(),
    week: integer().notNull(),
    homeTeam: text().notNull(),
    awayTeam: text().notNull(),
    kickoffUtc: timestamp({ withTimezone: true }).notNull(), // drives lock times
    spreadLine: numeric({ precision: 4, scale: 1 }), // HOME perspective; negative = home favored
    totalLine: numeric({ precision: 4, scale: 1 }),
    roof: roofEnum(),
    surface: text(),
    tempF: integer(), // null for domes
    windMph: integer(), // >15 meaningfully suppresses passing
  },
  (t) => [index("schedule_season_week_idx").on(t.season, t.week)],
);

export const injuries = pgTable(
  "injuries",
  {
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    season: integer().notNull(),
    week: integer().notNull(),
    reportStatus: reportStatusEnum(),
    practiceStatus: practiceStatusEnum(),
    yahooStatus: yahooInjuryStatusEnum(), // more current; prefer for game-day decisions
    bodyPart: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(), // staleness matters on Sunday
  },
  (t) => [primaryKey({ columns: [t.playerId, t.season, t.week] })],
);
