import {
  boolean,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leagues } from "./league";
import { players } from "./identity";

// Weekly player projections — the Phase 2 hot tier the web reads. One live row
// per (league, player, season, week), upserted by the api project job; the
// model-version history + the full distribution archive live in Parquet on the
// VPS. Scoped by league_id because a projection is scoring-specific (a second
// league with different scoring reorders the board). p20/p50/p80/sd are null
// until Layer 3 (distributions); Layer 0 fills mean + is_playing only.
export const projections = pgTable(
  "projections",
  {
    leagueId: uuid()
      .notNull()
      .references(() => leagues.id),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    season: integer().notNull(),
    week: integer().notNull(),
    mean: numeric({ precision: 6, scale: 2 }).notNull(),
    p20: numeric({ precision: 6, scale: 2 }),
    p50: numeric({ precision: 6, scale: 2 }),
    p80: numeric({ precision: 6, scale: 2 }),
    sd: numeric({ precision: 6, scale: 2 }),
    isPlaying: boolean().notNull(),
    modelVersion: text().notNull(),
    generatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.playerId, t.season, t.week] })],
);
