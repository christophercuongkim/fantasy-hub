CREATE TYPE "public"."transaction_type" AS ENUM('add', 'drop', 'add_drop', 'trade', 'commish');--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"yahoo_transaction_key" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" text,
	"executed_at" timestamp with time zone,
	"player_id" uuid NOT NULL,
	"source_team_id" uuid,
	"source_type" text,
	"destination_team_id" uuid,
	"destination_type" text,
	"faab_bid" integer,
	CONSTRAINT "transactions_leagueId_yahooTransactionKey_playerId_unique" UNIQUE("league_id","yahoo_transaction_key","player_id")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_team_id_league_teams_id_fk" FOREIGN KEY ("source_team_id") REFERENCES "public"."league_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_team_id_league_teams_id_fk" FOREIGN KEY ("destination_team_id") REFERENCES "public"."league_teams"("id") ON DELETE no action ON UPDATE no action;