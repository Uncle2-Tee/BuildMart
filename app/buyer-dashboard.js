import Marketplace from "./marketplace";
import BuyerOrders from "./buyer-orders";

export default function BuyerDashboard({ displayName, email, products, orders, isConfigured, catalogError, page = "shop" }) {
  return (
    <Marketplace
      products={products}
      isConfigured={isConfigured}
      catalogError={catalogError}
      buyerMode
      buyerPage={page}
      buyerEmail={email}
    >
      {page === "orders" ? <BuyerOrders orders={orders} displayName={displayName} /> : null}
    </Marketplace>
  );
}
