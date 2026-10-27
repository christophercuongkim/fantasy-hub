import { EmptyState, PageBody, PageHeader } from "@seakim/design-system";
import { latestProjections } from "@/lib/projections";
import { ProjectionsTable } from "./table";
import { RefreshAll } from "./RefreshAll";

export const dynamic = "force-dynamic"; // reads live DB

// Admin-only — gated by the middleware (see middleware.ts). Weekly baseline
// projections written by the api project job.
export default async function Projections() {
  const data = await latestProjections();

  return (
    <PageBody width="full">
      <PageHeader
        title="Projections"
        description={
          data
            ? `Floor · projection · ceiling · ${data.season} week ${data.week}`
            : "Weekly projections with floor and ceiling."
        }
        actions={<RefreshAll />}
      />

      {data ? (
        <ProjectionsTable rows={data.rows} />
      ) : (
        <EmptyState
          icon="chart-line"
          title="No projections yet"
          description="Hit “Refresh all” to ingest the seasons and project every week."
        />
      )}
    </PageBody>
  );
}
