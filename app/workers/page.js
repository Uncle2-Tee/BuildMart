import Link from "next/link";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../lib/supabase/admin";
import WorkerMarketplace from "../worker-marketplace";

export const metadata = {
  title: "Find skilled workers | BuildMart Ghana",
  description: "Find trusted masons, painters, tilers, carpenters and other skilled workers for your next project.",
};

export default async function WorkersPage() {
  if (!isSupabaseAdminConfigured()) {
    return <main className="worker-page"><div className="worker-empty"><h1>Worker marketplace setup needed</h1><p>Connect Supabase to browse available professionals.</p><Link href="/">Return to marketplace</Link></div></main>;
  }

  const admin = createSupabaseAdminClient();
  const { data: workers, error } = await admin
    .from("worker_profiles")
    .select("id, name, trade, bio, location, phone, years_experience, hourly_rate_kobo, avatar_url, rating_average, rating_count")
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("rating_average", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    const workerTablesMissing = error.code === "PGRST205" ||
      error.message?.includes("worker_profiles");
    if (!workerTablesMissing) {
      console.error("Unable to load worker marketplace", error);
    }
    return (
      <main className="worker-page">
        <div className="worker-empty">
          <h1>{workerTablesMissing ? "Worker marketplace setup needed" : "Workers are taking a short break"}</h1>
          <p>
            {workerTablesMissing
              ? "Apply the worker marketplace migration in Supabase before adding worker profiles."
              : "We could not load the worker directory. Please try again shortly."}
          </p>
          {workerTablesMissing ? (
            <p><code>prisma/migrations/20261101000000_create_worker_marketplace/migration.sql</code></p>
          ) : null}
          <Link href="/">Return to marketplace</Link>
        </div>
      </main>
    );
  }

  return <WorkerMarketplace workers={workers ?? []} />;
}
