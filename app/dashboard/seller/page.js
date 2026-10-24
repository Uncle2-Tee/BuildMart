import SellerDashboard from "../../seller-dashboard";
import { requireRole } from "../../../lib/auth";

export const metadata = {
  title: "Seller dashboard | BuildMart Ghana",
};

export default async function SellerDashboardPage() {
  const { supabase, user, profile } = await requireRole(["seller"], {
    loginRedirect: "/seller/login",
  });
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
      .select("id, buyer_email, status, created_at, delivery_name, delivery_phone, delivery_region, delivery_city, delivery_address, delivery_digital_address, delivery_instructions, order_items!inner(product_title, quantity, unit_price_kobo, seller_id)")
      .eq("order_items.seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (productsError) throw new Error(`Unable to load seller products: ${productsError.message}`);
  if (ordersError) throw new Error(`Unable to load seller orders: ${ordersError.message}`);

  return <SellerDashboard displayName={profile.display_name} shop={shop} shopStatus={profile.seller_status} products={products ?? []} orders={orders ?? []} />;
}
