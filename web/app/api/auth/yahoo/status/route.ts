import { NextResponse } from "next/server";
import { getStatus } from "@/lib/yahoo/tokens";

// Report Yahoo connection state (no tokens exposed) for the UI / health.
export async function GET() {
  try {
    return NextResponse.json(await getStatus());
  } catch {
    return NextResponse.json(
      { connected: false, error: "unavailable" },
      { status: 503 },
    );
  }
}
