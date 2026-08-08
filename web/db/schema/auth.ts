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

// The logged-in Yahoo session Cookie header, for the pub-api-rw fantasy API the
// web app uses (it takes session cookies; the public OAuth host refuses them).
// AES-256-GCM at rest with the same TOKEN_ENC_KEY the api holds. Pasted by the
// admin from a browser request; re-pasted when it expires (a 401 from Yahoo).
export const yahooCookies = pgTable("yahoo_cookies", {
  id: text().primaryKey().default("default"),
  cookieEnc: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
