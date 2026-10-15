import { redirect } from "next/navigation";
import Marketplace from "./marketplace";
import { requireRole } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase/server";
import { getApprovedProductCatalog } from "../lib/buyer-dashboard-data";

export default async function Home() {
  if (!isSupabaseConfigured()) redirect("/login");
  const { profile } = await requireRole(["buyer", "seller", "admin"]);
  if (profile.role === "buyer") redirect("/dashboard/buyer");
  if (profile.role === "seller") redirect("/dashboard/seller/market");
  const products = await getApprovedProductCatalog();

  return (
    <Marketplace
      products={products}
      isConfigured
      catalogError={false}
      dashboardHref="/admin"
    />
  );
}
