import Link from "next/link";
import BuyerDashboard from "../../../buyer-dashboard";
import { requireRole } from "../../../../lib/auth";
import { getBuyerOrderHistory } from "../../../../lib/buyer-dashboard-data";
import { isSupabaseConfigured } from "../../../../lib/supabase/server";

export const metadata = {
  title: "My orders | BuildMart Ghana",
};

export default async function BuyerOrdersPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-empty"><h1>Buyer account setup needed</h1><p>Connect Supabase and apply the database migration to sign in securely.</p><Link href="/login">Return to log in</Link></div>
      </main>
    );
  }

  const { supabase, user, profile } = await requireRole(["buyer"]);
  const orders = await getBuyerOrderHistory(supabase, user.id);

  return (
    <BuyerDashboard
      displayName={profile.display_name}
      email={user.email ?? ""}
      products={[]}
      orders={orders}
      isConfigured
      catalogError={false}
      page="orders"
    />
  );
}
