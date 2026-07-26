import { pgEnum } from "drizzle-orm/pg-core";

// Fantasy-relevant positions first; OL/DL/LB/DB kept for completeness. See data dictionary §players.
export const positionEnum = pgEnum("position", [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
  "OL",
  "DL",
  "LB",
  "DB",
]);

// Yahoo roster-level player status (players.status).
export const playerStatusEnum = pgEnum("player_status", [
  "ACT",
  "IR",
  "PUP",
  "SUSP",
  "NFI",
  "FA",
]);

// Lineup slot a player occupies in a given week (rosters.slot).
export const rosterSlotEnum = pgEnum("roster_slot", [
  "QB",
  "RB",
  "WR",
  "TE",
  "W/R/T",
  "K",
  "DEF",
  "BN",
  "IR",
]);

export const acquiredViaEnum = pgEnum("acquired_via", [
  "draft",
  "waiver",
  "freeagent",
  "trade",
]);

export const crosswalkSourceEnum = pgEnum("crosswalk_source", [
  "yahoo",
  "espn",
  "sleeper",
  "pfr",
]);

export const crosswalkMethodEnum = pgEnum("crosswalk_method", [
  "nflverse_ids",
  "exact_name",
  "fuzzy",
  "manual",
]);

export const waiverTypeEnum = pgEnum("waiver_type", [
  "FAAB",
  "rolling",
  "reverse",
]);

// nflverse injury report status (injuries.report_status).
export const reportStatusEnum = pgEnum("report_status", [
  "Out",
  "Doubtful",
  "Questionable",
]);

export const practiceStatusEnum = pgEnum("practice_status", [
  "DNP",
  "Limited",
  "Full",
]);

// Yahoo game-day injury status (injuries.yahoo_status) — more current than nflverse.
export const yahooInjuryStatusEnum = pgEnum("yahoo_injury_status", [
  "O",
  "D",
  "Q",
  "IR",
  "PUP",
  "SUSP",
]);

export const roofEnum = pgEnum("roof", ["outdoors", "dome", "closed", "open"]);
