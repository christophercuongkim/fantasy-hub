DROP INDEX "players_gsis_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "players_gsis_id_idx" ON "players" USING btree ("gsis_id");