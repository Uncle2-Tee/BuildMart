import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import WorkerProfileForm from "../../worker-profile-form";
import SignOutButton from "../../sign-out-button";

export const metadata = { title: "Worker dashboard | BuildMart Ghana" };

export default async function WorkerDashboardPage() {
  const supabase = await createSupabaseServerClient({ readOnly: true });
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/worker/login");
  const admin = createSupabaseAdminClient();
  const { data: worker, error: workerError } = await admin.from("worker_profiles").select("*").eq("profile_id", data.claims.sub).maybeSingle();
  if (workerError || !worker) redirect("/worker/signup");
  return <main className="worker-dashboard-page"><header className="worker-dashboard-header"><Link href="/workers" className="worker-back-link">← Find workers</Link><strong>Worker dashboard</strong><SignOutButton /></header><section className="worker-dashboard-card"><span className="worker-kicker">YOUR PROFESSIONAL PROFILE</span><h1>Make your work easy to find.</h1><p>Complete your profile so customers can understand your experience and request your services.</p><WorkerProfileForm initialWorker={worker} /></section></main>;
}
