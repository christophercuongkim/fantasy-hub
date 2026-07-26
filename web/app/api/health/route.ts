import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

const API_URL = process.env.API_URL ?? "http://localhost:4001";

// Web health check. Reports the web layer, proxies the API's health, and probes
// Postgres so a single request tells you whether all three are up.
export async function GET() {
  let api: string;
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    api = res.ok ? "ok" : `error (HTTP ${res.status})`;
  } catch {
    api = "unreachable";
  }

  let postgres: string;
  try {
    await getDb().execute(sql`select 1`);
    postgres = "ok";
  } catch {
    postgres = "unreachable";
  }

  const ok = api === "ok" && postgres === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", web: "ok", api, postgres },
    { status: ok ? 200 : 503 },
  );
}
