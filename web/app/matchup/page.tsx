import { EmptyState } from "@seakim/design-system";
import {
  defaultMatchupWeek,
  matchupLeagues,
  simMatchupWeek,
} from "@/lib/matchups";
import { MatchupBoard } from "./MatchupBoard";

export const dynamic = "force-dynamic"; // reads live DB + runs the sim

// Admin-only (middleware). Layer 4 Monte Carlo: win probability + score
// distribution for every matchup in a league-week, from the real lineups.
export default async function Matchup() {
  const [leagues, def] = await Promise.all([
    matchupLeagues(),
    defaultMatchupWeek(),
  ]);

  // SSR the default week so the board isn't empty on first paint. When nothing
  // qualifies yet (no synced matchups+rosters), fall back to the newest league.
  const initialKey = def?.key ?? leagues[0]?.key ?? "";
  const initialWeek = def?.week ?? 1;
  const initial = initialKey
    ? await simMatchupWeek(initialKey, initialWeek)
    : { error: "No leagues synced yet." };

  return (
    <main
      style={{
        maxWidth: "60rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <div>
        <h1 style={{ font: "var(--type-title)", color: "var(--text-primary)" }}>
          Matchup sim
        </h1>
        <p
          style={{
            marginTop: "var(--space-1)",
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Win probability and projected score range for each pairing — 10,000
          Monte Carlo draws from the weekly projections.
        </p>
      </div>

      {leagues.length ? (
        <MatchupBoard
          leagues={leagues}
          initialKey={initialKey}
          initialWeek={initialWeek}
          initialResult={initial.result}
          initialError={initial.error}
        />
      ) : (
        <EmptyState
          icon="football"
          title="No leagues yet"
          description="Sync a Yahoo league first, then come back to simulate its matchups."
        />
      )}
    </main>
  );
}
