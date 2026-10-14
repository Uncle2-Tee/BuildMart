import Link from "next/link";
import BuyerDashboard from "../../buyer-dashboard";
import { requireRole } from "../../../lib/auth";
import { createSupabasePublicClient, isSupabaseConfigured } from "../../../lib/supabase/server";

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

  const { supabase, user, profile } = await requireRole(["buyer"]);
  const publicSupabase = createSupabasePublicClient();
  const [
    { data: products, error: productsError },
    { data: orders, error: ordersError },
  ] = await Promise.all([
    publicSupabase
      .from("products")
      .select("id, title, description, category, price_kobo, image_url")
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, status, total_kobo, created_at, order_items(product_title, quantity)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (productsError) throw new Error(`Unable to load the product catalogue: ${productsError.message}`);
  if (ordersError) throw new Error(`Unable to load buyer orders: ${ordersError.message}`);

  return (
    <BuyerDashboard
      displayName={profile.display_name}
      email={user.email ?? ""}
      products={products ?? []}
      orders={orders ?? []}
      isConfigured
      catalogError={false}
    />
  );
}
