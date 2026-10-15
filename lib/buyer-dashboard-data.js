import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

export async function getApprovedProductCatalog() {
  const admin = createSupabaseAdminClient();
  const { data: approvedSellers, error: sellersError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "seller")
    .eq("seller_status", "approved");

  if (sellersError) throw new Error(`Unable to load approved shops: ${sellersError.message}`);
  const sellerIds = (approvedSellers ?? []).map((seller) => seller.id);
  if (!sellerIds.length) return [];

  const { data, error } = await admin
    .from("products")
    .select("id, title, description, category, price_kobo, image_url")
    .eq("active", true)
    .in("seller_id", sellerIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load the product catalogue: ${error.message}`);
  return data ?? [];
}

export async function getBuyerOrderHistory(supabase, buyerId) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, total_kobo, created_at, order_items(product_title, quantity)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Unable to load buyer orders: ${error.message}`);
  return data ?? [];
}
