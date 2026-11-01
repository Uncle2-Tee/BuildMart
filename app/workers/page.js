import Link from "next/link";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../lib/supabase/admin";
import { getWorkerDirectoryCache } from "../../lib/worker-directory-cache";
import WorkerMarketplace from "../worker-marketplace";

const WORKER_CACHE_MS = 60 * 1000;
const WORKER_TIMEOUT_MS = 8 * 1000;
export const metadata = {
  title: "Find skilled workers | BuildMart Ghana",
  description: "Find trusted masons, painters, tilers, carpenters and other skilled workers for your next project.",
};

function loadWorkers() {
  const cache = getWorkerDirectoryCache();
  if (cache.data && cache.expiresAt > Date.now()) {
    return Promise.resolve(cache.data);
  }

  if (cache.request) return cache.request;

  const admin = createSupabaseAdminClient();
  const request = admin
    .from("worker_profiles")
    .select("id, name, trade, bio, location, phone, years_experience, hourly_rate_kobo, avatar_url, rating_average, rating_count")
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("rating_average", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  cache.request = Promise.race([
    request,
    new Promise((resolve) => setTimeout(() => resolve({
      data: null,
      error: { code: "WORKER_TIMEOUT", message: "Worker directory request timed out." },
    }), WORKER_TIMEOUT_MS)),
  ]).then((result) => {
    if (!result.error) {
      cache.data = result.data ?? [];
      cache.expiresAt = Date.now() + WORKER_CACHE_MS;
    }
    return result;
  }).finally(() => {
    cache.request = null;
  });

  return cache.request;
}

export default async function WorkersPage() {
  if (!isSupabaseAdminConfigured()) {
    return <main className="worker-page"><div className="worker-empty"><h1>Worker marketplace setup needed</h1><p>Connect Supabase to browse available professionals.</p><Link href="/">Return to marketplace</Link></div></main>;
  }

  const { data: workers, error } = await loadWorkers();

  if (error) {
    const workerTablesMissing = error.code === "PGRST205" ||
      error.message?.includes("worker_profiles");
    if (!workerTablesMissing) {
      console.error("Unable to load worker marketplace", error);
    }
    return (
      <main className="worker-page">
        <div className="worker-empty">
          <h1>{workerTablesMissing ? "Worker marketplace setup needed" : error.code === "WORKER_TIMEOUT" ? "Worker directory is taking a moment" : "Workers are taking a short break"}</h1>
          <p>
            {workerTablesMissing
              ? "Apply the worker marketplace migration in Supabase before adding worker profiles."
              : error.code === "WORKER_TIMEOUT"
                ? "The directory took too long to respond. Please refresh and try again."
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
