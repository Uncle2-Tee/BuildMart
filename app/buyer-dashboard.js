import Marketplace from "./marketplace";

export default function BuyerDashboard({ products, isConfigured, catalogError }) {
  return (
    <Marketplace
      products={products}
      isConfigured={isConfigured}
      catalogError={catalogError}
      buyerMode
    />
  );
}
