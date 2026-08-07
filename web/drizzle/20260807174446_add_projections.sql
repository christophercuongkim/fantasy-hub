CREATE TABLE "projections" (
	"league_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"mean" numeric(6, 2) NOT NULL,
	"p20" numeric(6, 2),
	"p50" numeric(6, 2),
	"p80" numeric(6, 2),
	"sd" numeric(6, 2),
	"is_playing" boolean NOT NULL,
	"model_version" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "projections_league_id_player_id_season_week_pk" PRIMARY KEY("league_id","player_id","season","week")
);
--> statement-breakpoint
ALTER TABLE "projections" ADD CONSTRAINT "projections_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projections" ADD CONSTRAINT "projections_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;