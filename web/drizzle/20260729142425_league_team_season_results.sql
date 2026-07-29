ALTER TABLE "league_teams" ADD COLUMN "final_rank" integer;--> statement-breakpoint
ALTER TABLE "league_teams" ADD COLUMN "wins" integer;--> statement-breakpoint
ALTER TABLE "league_teams" ADD COLUMN "losses" integer;--> statement-breakpoint
ALTER TABLE "league_teams" ADD COLUMN "ties" integer;--> statement-breakpoint
ALTER TABLE "league_teams" ADD COLUMN "points_for" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "league_teams" ADD COLUMN "points_against" numeric(7, 2);