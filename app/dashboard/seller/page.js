import Link from "next/link";
import SellerDashboard from "../../seller-dashboard";
import { requireRole } from "../../../lib/auth";
import { isSupabaseConfigured } from "../../../lib/supabase/server";

export const metadata = {
  title: "Seller dashboard | BuildMart Ghana",
};

export default async function SellerDashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-empty"><h1>Seller dashboard setup needed</h1><p>Connect Supabase and apply the database migration to secure seller access.</p><Link href="/">Return to marketplace</Link></div>
      </main>
    );
  }

  const { supabase, user, profile } = await requireRole(["seller"]);
  const userMetadata = user.user_metadata ?? {};
  const shop = typeof userMetadata.shop_name === "string" && userMetadata.shop_name.trim()
    ? {
        name: userMetadata.shop_name,
        description: typeof userMetadata.shop_description === "string" ? userMetadata.shop_description : "",
        location: typeof userMetadata.shop_location === "string" ? userMetadata.shop_location : "",
        phone: typeof userMetadata.shop_phone === "string" ? userMetadata.shop_phone : "",
      }
    : null;

  if (profile.seller_status !== "approved" || !shop) {
    return (
      <SellerDashboard
        displayName={profile.display_name}
        shop={shop}
        shopStatus={profile.seller_status}
        products={[]}
        orders={[]}
      />
    );
  }

  const [{ data: products, error: productsError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase
      .from("products")
      .select("id, title, category, price_kobo, image_url, active, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, buyer_email, status, created_at, order_items(product_title, quantity, unit_price_kobo)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (productsError) throw new Error(`Unable to load seller products: ${productsError.message}`);
  if (ordersError) throw new Error(`Unable to load seller orders: ${ordersError.message}`);

  return <SellerDashboard displayName={profile.display_name} shop={shop} shopStatus={profile.seller_status} products={products ?? []} orders={orders ?? []} />;
}
