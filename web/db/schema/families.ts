import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sportEnum } from "./enums";

// A recurring league across seasons: Yahoo renews a league yearly under a stable
// slug, minting a NEW league_key each season. The family groups those seasons.
// One family per (sport, slug); each season is its own `leagues` row -> family.
export const leagueFamilies = pgTable(
  "league_families",
  {
    id: uuid().primaryKey().defaultRandom(),
    sport: sportEnum().notNull(),
    yahooSlug: text().notNull(), // e.g. "people_can_eat" (stable across seasons)
    name: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.sport, t.yahooSlug)],
);

// Canonical person, GLOBAL across every league and sport. Keyed on the Yahoo
// profile GUID (same for a user everywhere on Yahoo). display_name follows the
// "latest season wins" rule; it's the single source of truth for a person's
// name — league_teams point here rather than storing their own copy.
export const managers = pgTable("managers", {
  id: uuid().primaryKey().defaultRandom(),
  yahooGuid: text().notNull().unique(), // e.g. "OJP3ANS4PWZCN2H4IV5PZ6PAT4"
  displayName: text().notNull(),
  email: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
