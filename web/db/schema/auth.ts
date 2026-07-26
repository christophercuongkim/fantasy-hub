import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Yahoo OAuth tokens. Single-user app, so a single row keyed by a constant id.
// Tokens are AES-256-GCM encrypted at rest with TOKEN_ENC_KEY (a shared key the
// api service also holds, so Python can decrypt + refresh them). Written by the
// web OAuth callback; read/refreshed by both web and the api's YahooClient.
export const yahooTokens = pgTable("yahoo_tokens", {
  id: text().primaryKey().default("default"),
  accessTokenEnc: text().notNull(),
  refreshTokenEnc: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  guid: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
