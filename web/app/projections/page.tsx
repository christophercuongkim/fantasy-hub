import { EmptyState } from "@seakim/design-system";
import { latestProjections } from "@/lib/projections";
import { ProjectionsTable } from "./table";

export const dynamic = "force-dynamic"; // reads live DB

// Admin-only — gated by the middleware (see middleware.ts). Weekly baseline
// projections written by the api project job.
export default async function Projections() {
  const data = await latestProjections();

  return (
    <main
      style={{
        maxWidth: "56rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <header>
        <h1 style={{ font: "var(--type-title)", color: "var(--text-primary)" }}>
          Projections
        </h1>
        <p
          style={{
            marginTop: "var(--space-1)",
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {data
            ? `Baseline model · ${data.season} week ${data.week}`
            : "Weekly baseline projections."}
        </p>
      </header>

      {data ? (
        <ProjectionsTable rows={data.rows} />
      ) : (
        <EmptyState
          icon="chart-line"
          title="No projections yet"
          description="Run the api project job (ingest → aggregate → project) to populate a week."
        />
      )}
    </main>
  );
}
