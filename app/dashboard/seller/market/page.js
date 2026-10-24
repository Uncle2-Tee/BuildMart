import Link from "next/link";
import SellerMarketPreview from "../../../seller-market-preview";
import { requireRole } from "../../../../lib/auth";
import { isSupabaseConfigured } from "../../../../lib/supabase/server";

export const metadata = {
  title: "Market | BuildMart Ghana",
};

export default async function SellerMarketPage() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { supabase, user, profile } = await requireRole(["seller"], {
    loginRedirect: "/seller/login",
  });
  const shopName = typeof user.user_metadata?.shop_name === "string"
    ? user.user_metadata.shop_name
    : "";

  let products = [];
  if (profile.seller_status === "approved") {
    const { data, error } = await supabase
      .from("products")
      .select("id, title, description, category, price_kobo, image_url, active, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Unable to load seller product previews: ${error.message}`);
    products = data ?? [];
  }

  return (
    <>
      <header className="site-header seller-market-header">
        <div className="header-inner">
          <Link
            className="market-back-button"
            href="/dashboard/seller"
            prefetch
            aria-label="Back to seller dashboard"
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </header>
      {profile.seller_status === "approved" ? (
        <SellerMarketPreview products={products} shopName={shopName} />
      ) : (
        <main className="seller-market-empty seller-market-approval" aria-label="Market preview">
          <span className="eyebrow muted-eyebrow">MARKET PREVIEW</span>
          <h1>Your preview will be ready after shop approval.</h1>
          <p>Once your shop is approved, you can add products, review them here, and publish them when they are ready.</p>
          <Link className="button button-dark" href="/dashboard/seller">Back to seller dashboard</Link>
        </main>
      )}
    </>
  );
}
