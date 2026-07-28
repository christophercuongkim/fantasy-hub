CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sport" AS ENUM('nfl');--> statement-breakpoint
CREATE TABLE "league_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" "sport" NOT NULL,
	"yahoo_slug" text NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_families_sport_yahooSlug_unique" UNIQUE("sport","yahoo_slug")
);
--> statement-breakpoint
CREATE TABLE "managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"yahoo_guid" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "managers_yahooGuid_unique" UNIQUE("yahoo_guid")
);
--> statement-breakpoint
CREATE TABLE "team_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_team_id" uuid NOT NULL,
	"claimant_manager_id" uuid NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_teams" ALTER COLUMN "yahoo_team_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "league_teams" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "family_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "sport" "sport" NOT NULL;--> statement-breakpoint
ALTER TABLE "team_claims" ADD CONSTRAINT "team_claims_league_team_id_league_teams_id_fk" FOREIGN KEY ("league_team_id") REFERENCES "public"."league_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_claims" ADD CONSTRAINT "team_claims_claimant_manager_id_managers_id_fk" FOREIGN KEY ("claimant_manager_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_teams" ADD CONSTRAINT "league_teams_manager_id_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_family_id_league_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."league_families"("id") ON DELETE no action ON UPDATE no action;