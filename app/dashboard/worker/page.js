import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import WorkerProfileForm from "../../worker-profile-form";
import WorkerStatusControl from "../../worker-status-control";
import WorkerBookingHistory from "../../worker-booking-history";
import WorkerDashboardRefresh from "../../worker-dashboard-refresh";
import SignOutButton from "../../sign-out-button";

export const metadata = { title: "Worker dashboard | BuildMart Ghana" };

export default async function WorkerDashboardPage() {
  const supabase = await createSupabaseServerClient({ readOnly: true });
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/worker/login");
  const admin = createSupabaseAdminClient();
  const { data: worker, error: workerError } = await admin.from("worker_profiles").select("*").eq("profile_id", data.claims.sub).maybeSingle();
  if (workerError || !worker) redirect("/worker/signup");
  const { data: bookings, error: bookingsError } = await admin
    .from("worker_bookings")
    .select("id, customer_name, customer_phone, service_date, address, request_details, budget_kobo, status")
    .eq("worker_id", worker.id)
    .order("created_at", { ascending: false });
  if (bookingsError) {
    console.error("Unable to load worker booking history", bookingsError);
  }
  const isApproved = worker.approval_status === "approved" && worker.is_active;
  const profileApproved = worker.approval_status === "approved";
  return <main className="worker-dashboard-page"><WorkerDashboardRefresh /><header className="worker-dashboard-header"><Link href="/workers" className="worker-back-link">← Find workers</Link><strong>Worker dashboard</strong><SignOutButton /></header><section className="worker-dashboard-card"><span className="worker-kicker">YOUR PROFESSIONAL PROFILE</span><h1 className={isApproved ? "worker-profile-live-heading" : undefined}>{isApproved ? "Your profile is live." : "Make your work easy to find."}</h1><p>{isApproved ? "Your approved profile is visible to customers. You can edit your details at any time." : "Complete your profile so customers can understand your experience and request your services."}</p><WorkerStatusControl initialActive={worker.is_active} approved={profileApproved} /><WorkerProfileForm initialWorker={worker} /></section><WorkerBookingHistory bookings={bookingsError ? [] : bookings ?? []} /></main>;
}
