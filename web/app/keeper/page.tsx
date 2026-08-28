import { EmptyState } from "@seakim/design-system";
import { keeperContext } from "@/lib/keeper-context";
import { KeeperTool } from "./KeeperTool";

export const dynamic = "force-dynamic"; // reads the live board

// Admin-only (middleware). Preseason keeper valuator: upload the commissioner's
// keeper-cost sheet and see, for my team, which player returns the most value
// over the pick it would cost to keep — scored against this season's board.
export default async function Keeper() {
  const ctx = await keeperContext();

  return (
    <main
      style={{
        maxWidth: "64rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <div>
        <h1 style={{ font: "var(--type-title)", color: "var(--text-primary)" }}>
          Keeper valuator
        </h1>
        <p
          style={{
            marginTop: "var(--space-1)",
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {ctx
            ? `Upload the keeper-cost sheet — ${ctx.season} value over the pick each keeper costs, for ${ctx.myTeam ?? "your team"}.`
            : "Value each keeper against the pick it would cost."}
        </p>
      </div>

      {ctx && ctx.board.length > 0 ? (
        <KeeperTool
          season={ctx.season}
          numTeams={ctx.numTeams}
          myTeam={ctx.myTeam}
          board={ctx.board}
        />
      ) : (
        <EmptyState
          icon="list-numbers"
          title="No board yet"
          description="Build this season's draft board first, then upload the keeper sheet."
        />
      )}
    </main>
  );
}
