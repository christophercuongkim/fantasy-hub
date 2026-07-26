import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

// Lazy singleton so importing this module doesn't require DATABASE_URL at build
// time — it's only needed when a query actually runs.
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // prepare: false — Neon's pooled endpoint runs pgbouncer in transaction mode.
    const client = postgres(url, { prepare: false });
    cached = drizzle(client, { schema, casing: "snake_case" });
  }
  return cached;
}

export { schema };
