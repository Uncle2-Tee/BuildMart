import Marketplace from "./marketplace";

export default function BuyerDashboard({ email, products, isConfigured, catalogError }) {
  return (
    <Marketplace
      products={products}
      isConfigured={isConfigured}
      catalogError={catalogError}
      buyerMode
      buyerEmail={email}
    />
  );
}
