import {
  bigserial,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  crosswalkMethodEnum,
  crosswalkSourceEnum,
  playerStatusEnum,
  positionEnum,
} from "./enums";
import type { CrosswalkCandidate } from "./types";

// Canonical player identity. One row per human, ever. Never delete.
export const players = pgTable(
  "players",
  {
    id: uuid().primaryKey().defaultRandom(),
    gsisId: text(), // NFL official id, primary join key to stats
    pfrId: text(),
    espnId: text(),
    yahooId: text(), // not stable across games/sports
    sleeperId: text(),
    fullName: text().notNull(),
    nameNormalized: text().notNull(), // lowercase, suffixes/punctuation stripped; fuzzy-match key
    position: positionEnum().notNull(),
    team: text(), // mutable, updated weekly; null for free agents
    birthdate: date(),
    draftYear: integer(),
    draftRound: integer(),
    draftPick: integer(),
    rookieSeason: integer(),
    status: playerStatusEnum(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("players_name_normalized_idx").on(t.nameNormalized),
    index("players_gsis_id_idx").on(t.gsisId),
    index("players_yahoo_id_idx").on(t.yahooId),
  ],
);

// Audit trail for every ID match. Append-only.
export const idCrosswalkLog = pgTable("id_crosswalk_log", {
  id: bigserial({ mode: "number" }).primaryKey(),
  source: crosswalkSourceEnum().notNull(),
  sourceId: text().notNull(), // the foreign id being mapped
  playerId: uuid().references(() => players.id), // null = unmatched (review queue)
  method: crosswalkMethodEnum().notNull(),
  confidence: numeric({ precision: 4, scale: 3 }), // 0-1; null for manual/nflverse_ids
  candidatesJson: jsonb().$type<CrosswalkCandidate[]>(),
  verifiedAt: timestamp({ withTimezone: true }), // null until a human confirms
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
