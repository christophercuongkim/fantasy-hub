import { EmptyState } from "@seakim/design-system";
import { latestDraftBoard } from "@/lib/draft-board";
import { DraftBoard } from "./DraftBoard";

export const dynamic = "force-dynamic"; // reads the live board

// Admin-only (middleware). Preseason draft value board — every draftable player
// ranked by VOR for this league's scoring, with market ADP + our value edge.
export default async function DraftAssistant() {
  const board = await latestDraftBoard();

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
          Draft assistant
        </h1>
        <p
          style={{
            marginTop: "var(--space-1)",
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {board
            ? `${board.season} value board — projected season points over replacement, with market ADP`
            : "Value over replacement for the upcoming draft."}
        </p>
      </div>

      {board ? (
        <DraftBoard
          leagueKey={board.leagueKey}
          rows={board.rows}
          season={board.season}
          myRoster={board.myRoster}
          draftedCount={board.draftedCount}
          rosterSlots={board.rosterSlots}
          numTeams={board.numTeams}
          myDraftPosition={board.myDraftPosition}
          myPickOveralls={board.myPickOveralls}
        />
      ) : (
        <EmptyState
          icon="list-numbers"
          title="No league yet"
          description="Sync a league first, then build the draft board."
        />
      )}
    </main>
  );
}
