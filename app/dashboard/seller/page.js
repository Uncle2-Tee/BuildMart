import Link from "next/link";
import SellerDashboard from "../../seller-dashboard";
import SignOutButton from "../../sign-out-button";
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
  if (profile.seller_status !== "approved") {
    const rejected = profile.seller_status === "rejected";
    return (
      <main className="dashboard-shell">
        <header className="dashboard-header">
          <Link className="brand" href="/"><span className="mark brand-mark">B</span><span>buildmart<span className="brand-country">GH</span></span></Link>
          <div className="dashboard-user"><Link href="/">View marketplace ↗</Link><SignOutButton /></div>
        </header>
        <div className="dashboard-empty">
          <h1>{rejected ? "Your shop needs attention" : "Your shop is under review"}</h1>
          <p>{rejected ? "An administrator has not approved this shop. Please contact BuildMart support for next steps." : "An administrator must approve your shop before you can publish products or receive orders."}</p>
          <span className={`status-pill ${rejected ? "paused" : "live"}`}>{rejected ? "Not approved" : "Pending approval"}</span>
          <p><Link href="/">Return to marketplace</Link></p>
        </div>
      </main>
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

  return <SellerDashboard displayName={profile.display_name} products={products ?? []} orders={orders ?? []} />;
}
