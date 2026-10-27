import { PageBody, PageHeader } from "@seakim/design-system";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { YahooSync } from "./YahooSync";

// Admin-only (gated by middleware /admin prefix). Paste the logged-in Yahoo
// cookie header, then sync a league's teams from pub-api-rw.
export const dynamic = "force-dynamic";

export default async function YahooAdmin() {
  const rows = (await getDb().execute(sql`
    select season, yahoo_league_key as key from leagues order by season desc
  `)) as unknown as { season: number; key: string }[];
  const leagues = rows.map((r) => ({
    season: Number(r.season),
    key: String(r.key),
  }));

  return (
    <PageBody width="form">
      <PageHeader
        title="Yahoo sync"
        description={
          <>
            Paste your logged-in Yahoo cookie header (DevTools → a{" "}
            <code>pub-api-rw</code> request → Copy → Copy as cURL → the{" "}
            <code>Cookie:</code> value), save it, then sync a league&rsquo;s
            teams. Re-paste when a sync returns a 401.
          </>
        }
      />
      <YahooSync leagues={leagues} />
    </PageBody>
  );
}
