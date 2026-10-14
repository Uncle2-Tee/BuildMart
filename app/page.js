import Marketplace from "./marketplace";
import { createSupabasePublicClient } from "../lib/supabase/server";

export default async function Home() {
  const supabase = createSupabasePublicClient();
  let products = [];
  let catalogError = false;

  if (supabase) {
    const { data, error } = await supabase
      .from("products")
      .select("id, title, description, category, price_kobo, image_url")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load the public product catalogue", error);
      catalogError = true;
    } else {
      products = data ?? [];
    }
  }

  return (
    <Marketplace
      products={products}
      isConfigured={Boolean(supabase)}
      catalogError={catalogError}
    />
  );
}
