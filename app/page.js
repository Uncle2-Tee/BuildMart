import { connection } from "next/server";
import Marketplace from "./marketplace";
import { getApprovedProductCatalog } from "../lib/buyer-dashboard-data";

export default async function Home() {
  await connection();
  const { products, catalogError } = await getApprovedProductCatalog();

  return (
    <Marketplace
      products={products}
      isConfigured
      catalogError={catalogError}
      shopFirst
    />
  );
}
