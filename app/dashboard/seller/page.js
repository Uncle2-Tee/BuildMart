import SellerDashboard from "../../seller-dashboard";
import { getShopApplicationSession } from "../../../lib/shop-application-session";
import { createSupabaseServerClient, isSupabaseConfigured } from "../../../lib/supabase/server";

export const metadata = {
  title: "Seller dashboard | BuildMart Ghana",
};

async function getSellerAccount() {
  const supabase = await createSupabaseServerClient({ readOnly: true });
  if (!supabase) return null;

  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) {
    if (claimsError.status === 400 || claimsError.status === 401) return null;
    throw new Error(`Unable to verify seller account: ${claimsError.message}`);
  }

  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, display_name, seller_status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load seller permissions: ${profileError.message}`);
  }
  if (profile?.role !== "seller") return null;

  return {
    supabase,
    profile,
    user: {
      id: userId,
      user_metadata: data.claims.user_metadata ?? {},
    },
  };
}

function PublicSellerPage() {
  return <SellerDashboard displayName="" shop={null} shopStatus="" products={[]} orders={[]} publicApplication />;
}

export default async function SellerDashboardPage() {
  const applicationSession = await getShopApplicationSession();
  if (applicationSession) {
    const { admin, application } = applicationSession;
    if (application.status !== "approved" || !application.seller_id) {
      return (
        <SellerDashboard
          displayName={application.shop_name}
          shop={{
            name: application.shop_name,
            description: application.shop_description,
            location: application.shop_location,
            phone: application.shop_phone,
          }}
          shopStatus={application.status}
          products={[]}
          orders={[]}
          publicApplication
        />
      );
    }

    const [{ data: products, error: productsError }, { data: orders, error: ordersError }] = await Promise.all([
      admin.from("products")
        .select("id, title, category, price_kobo, image_url, active, created_at")
        .eq("seller_id", application.seller_id)
        .order("created_at", { ascending: false }),
      admin.from("orders")
        .select("id, buyer_email, status, created_at, order_items!inner(product_title, quantity, unit_price_kobo, seller_id)")
        .eq("order_items.seller_id", application.seller_id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (productsError) throw new Error(`Unable to load seller products: ${productsError.message}`);
    if (ordersError) throw new Error(`Unable to load seller orders: ${ordersError.message}`);

    return (
      <SellerDashboard
        displayName={application.shop_name}
        shop={{
          name: application.shop_name,
          description: application.shop_description,
          location: application.shop_location,
          phone: application.shop_phone,
        }}
        shopStatus="approved"
        products={products ?? []}
        orders={orders ?? []}
      />
    );
  }

  if (!isSupabaseConfigured()) return <PublicSellerPage />;

  const sellerAccount = await getSellerAccount();
  if (!sellerAccount) return <PublicSellerPage />;

  const { supabase, user, profile } = sellerAccount;
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
