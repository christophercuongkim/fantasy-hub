CREATE TYPE "public"."acquired_via" AS ENUM('draft', 'waiver', 'freeagent', 'trade');--> statement-breakpoint
CREATE TYPE "public"."crosswalk_method" AS ENUM('nflverse_ids', 'exact_name', 'fuzzy', 'manual');--> statement-breakpoint
CREATE TYPE "public"."crosswalk_source" AS ENUM('yahoo', 'espn', 'sleeper', 'pfr');--> statement-breakpoint
CREATE TYPE "public"."player_status" AS ENUM('ACT', 'IR', 'PUP', 'SUSP', 'NFI', 'FA');--> statement-breakpoint
CREATE TYPE "public"."position" AS ENUM('QB', 'RB', 'WR', 'TE', 'K', 'DST', 'OL', 'DL', 'LB', 'DB');--> statement-breakpoint
CREATE TYPE "public"."practice_status" AS ENUM('DNP', 'Limited', 'Full');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('Out', 'Doubtful', 'Questionable');--> statement-breakpoint
CREATE TYPE "public"."roof" AS ENUM('outdoors', 'dome', 'closed', 'open');--> statement-breakpoint
CREATE TYPE "public"."roster_slot" AS ENUM('QB', 'RB', 'WR', 'TE', 'W/R/T', 'K', 'DEF', 'BN', 'IR');--> statement-breakpoint
CREATE TYPE "public"."waiver_type" AS ENUM('FAAB', 'rolling', 'reverse');--> statement-breakpoint
CREATE TYPE "public"."yahoo_injury_status" AS ENUM('O', 'D', 'Q', 'IR', 'PUP', 'SUSP');--> statement-breakpoint
CREATE TABLE "id_crosswalk_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" "crosswalk_source" NOT NULL,
	"source_id" text NOT NULL,
	"player_id" uuid,
	"method" "crosswalk_method" NOT NULL,
	"confidence" numeric(4, 3),
	"candidates_json" jsonb,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gsis_id" text,
	"pfr_id" text,
	"espn_id" text,
	"yahoo_id" text,
	"sleeper_id" text,
	"full_name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"position" "position" NOT NULL,
	"team" text,
	"birthdate" date,
	"draft_year" integer,
	"draft_round" integer,
	"draft_pick" integer,
	"rookie_season" integer,
	"status" "player_status",
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"yahoo_team_key" text NOT NULL,
	"name" text NOT NULL,
	"manager_name" text,
	"is_mine" boolean DEFAULT false NOT NULL,
	"draft_position" integer
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"yahoo_league_key" text NOT NULL,
	"name" text NOT NULL,
	"season" integer NOT NULL,
	"num_teams" integer NOT NULL,
	"scoring_json" jsonb NOT NULL,
	"roster_positions_json" jsonb NOT NULL,
	"playoff_start_week" integer NOT NULL,
	"num_playoff_teams" integer NOT NULL,
	"waiver_type" "waiver_type",
	"trade_deadline" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_yahooLeagueKey_unique" UNIQUE("yahoo_league_key")
);
--> statement-breakpoint
CREATE TABLE "matchups" (
	"league_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"team_a_id" uuid NOT NULL,
	"team_b_id" uuid NOT NULL,
	"team_a_score" numeric(6, 2),
	"team_b_score" numeric(6, 2),
	"is_playoff" boolean DEFAULT false NOT NULL,
	CONSTRAINT "matchups_league_id_week_team_a_id_pk" PRIMARY KEY("league_id","week","team_a_id")
);
--> statement-breakpoint
CREATE TABLE "rosters" (
	"league_team_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"slot" "roster_slot" NOT NULL,
	"is_starter" boolean NOT NULL,
	"acquired_via" "acquired_via",
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rosters_league_team_id_week_player_id_pk" PRIMARY KEY("league_team_id","week","player_id")
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"league_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"overall" integer NOT NULL,
	"round" integer NOT NULL,
	"pick_in_round" integer NOT NULL,
	"league_team_id" uuid NOT NULL,
	"player_id" uuid,
	"cost" integer,
	"adp_at_time" numeric(5, 1),
	"reach_delta" numeric(5, 1),
	CONSTRAINT "draft_picks_league_id_season_overall_pk" PRIMARY KEY("league_id","season","overall")
);
--> statement-breakpoint
CREATE TABLE "injuries" (
	"player_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"report_status" "report_status",
	"practice_status" "practice_status",
	"yahoo_status" "yahoo_injury_status",
	"body_part" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "injuries_player_id_season_week_pk" PRIMARY KEY("player_id","season","week")
);
--> statement-breakpoint
CREATE TABLE "schedule" (
	"game_id" text PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"kickoff_utc" timestamp with time zone NOT NULL,
	"spread_line" numeric(4, 1),
	"total_line" numeric(4, 1),
	"roof" "roof",
	"surface" text,
	"temp_f" integer,
	"wind_mph" integer
);
--> statement-breakpoint
ALTER TABLE "id_crosswalk_log" ADD CONSTRAINT "id_crosswalk_log_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_teams" ADD CONSTRAINT "league_teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_team_a_id_league_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."league_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_team_b_id_league_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."league_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_league_team_id_league_teams_id_fk" FOREIGN KEY ("league_team_id") REFERENCES "public"."league_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_league_team_id_league_teams_id_fk" FOREIGN KEY ("league_team_id") REFERENCES "public"."league_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "players_name_normalized_idx" ON "players" USING btree ("name_normalized");--> statement-breakpoint
CREATE INDEX "players_gsis_id_idx" ON "players" USING btree ("gsis_id");--> statement-breakpoint
CREATE INDEX "players_yahoo_id_idx" ON "players" USING btree ("yahoo_id");--> statement-breakpoint
CREATE INDEX "schedule_season_week_idx" ON "schedule" USING btree ("season","week");