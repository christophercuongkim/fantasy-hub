"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SeasonFilter } from "@/components/SeasonFilter";

/** Pages that read `?season=` today — chrome filter only mounts there. */
const SEASON_PATHS = new Set(["/hall_of_records", "/draft"]);

/**
 * Shell season control (decision 9A): URL is source of truth, scoped to the
 * current path so HoR/Draft keep shareable `?season=` links.
 */
export function ChromeSeason({ seasons }: { seasons: number[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!SEASON_PATHS.has(pathname)) return null;
  if (!seasons.length) return null;

  const raw = searchParams.get("season");
  const value = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;

  return (
    <SeasonFilter
      basePath={pathname}
      seasons={seasons}
      value={value}
      allLabel={pathname === "/hall_of_records" ? "All-time" : "All seasons"}
    />
  );
}
