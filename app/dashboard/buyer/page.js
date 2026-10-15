import Link from "next/link";
import BuyerDashboard from "../../buyer-dashboard";
import { requireRole } from "../../../lib/auth";
import { getApprovedProductCatalog } from "../../../lib/buyer-dashboard-data";
import { isSupabaseConfigured } from "../../../lib/supabase/server";

export const metadata = {
  title: "Buyer dashboard | BuildMart Ghana",
};

export default async function BuyerDashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-empty"><h1>Buyer account setup needed</h1><p>Connect Supabase and apply the database migration to sign in securely.</p><Link href="/">Return to marketplace</Link></div>
      </main>
    );
  }

  const { user, profile } = await requireRole(["buyer"]);

  return (
    <BuyerDashboard
      displayName={profile.display_name}
      email={user.email ?? ""}
      products={[]}
      orders={[]}
      isConfigured
      catalogError={false}
      page="home"
    />
  );
}
