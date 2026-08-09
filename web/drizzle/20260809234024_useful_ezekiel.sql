CREATE TABLE "draft_board" (
	"league_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"expected_ppg" numeric(6, 2) NOT NULL,
	"season_pts" numeric(6, 1) NOT NULL,
	"vor" numeric(6, 1) NOT NULL,
	"pos_rank" integer NOT NULL,
	"overall_rank" integer NOT NULL,
	"tier" integer NOT NULL,
	"adp" numeric(5, 1),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_board_league_id_season_player_id_pk" PRIMARY KEY("league_id","season","player_id")
);
--> statement-breakpoint
ALTER TABLE "draft_board" ADD CONSTRAINT "draft_board_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_board" ADD CONSTRAINT "draft_board_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;