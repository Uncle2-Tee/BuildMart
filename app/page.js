import Marketplace from "./marketplace";
import { getApprovedProductCatalog } from "../lib/buyer-dashboard-data";

export default async function Home() {
  const products = await getApprovedProductCatalog();

  return (
    <Marketplace
      products={products}
      isConfigured
      catalogError={false}
    />
  );
}
