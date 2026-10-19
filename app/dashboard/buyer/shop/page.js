import Link from "next/link";
import BuyerDashboard from "../../../buyer-dashboard";
import { requireRole } from "../../../../lib/auth";
import { getApprovedProductCatalog } from "../../../../lib/buyer-dashboard-data";
import { isSupabaseConfigured } from "../../../../lib/supabase/server";

export const metadata = {
  title: "Shop | BuildMart Ghana",
};

export default async function BuyerShopPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-empty"><h1>Buyer account setup needed</h1><p>Connect Supabase and apply the database migration to access buyer accounts.</p><Link href="/">Return to marketplace</Link></div>
      </main>
    );
  }

  const [{ user }, catalog] = await Promise.all([
    requireRole(["buyer"]),
    getApprovedProductCatalog(),
  ]);

  return (
    <BuyerDashboard
      email={user.email ?? ""}
      products={catalog.products}
      isConfigured
      catalogError={catalog.catalogError}
    />
  );
}
