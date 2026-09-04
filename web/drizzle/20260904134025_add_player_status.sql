CREATE TABLE "player_status" (
	"player_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"status" text NOT NULL,
	"status_full" text,
	"injury_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_status_player_id_season_pk" PRIMARY KEY("player_id","season")
);
--> statement-breakpoint
ALTER TABLE "player_status" ADD CONSTRAINT "player_status_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;