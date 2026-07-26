import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Timestamped migration filenames (YYYYMMDDHHMMSS_name.sql).
  migrations: { prefix: "timestamp" },
  // camelCase in TS -> snake_case columns; keep this in sync with db/index.ts.
  casing: "snake_case",
});
