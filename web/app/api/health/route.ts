import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

// Web health check. Reports the web layer as ok and proxies the API's health
// so a single probe tells you whether the browser-facing service and its
// backend are both up.
export async function GET() {
  let api: string;
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    api = res.ok ? "ok" : `error (HTTP ${res.status})`;
  } catch {
    api = "unreachable";
  }

  const ok = api === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", web: "ok", api },
    { status: ok ? 200 : 503 },
  );
}
