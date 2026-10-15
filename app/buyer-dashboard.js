import Marketplace from "./marketplace";

function formatPrice(priceKobo) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(priceKobo / 100);
}

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
      {page === "orders" ? <section className="dashboard-shell buyer-orders" id="buyer-orders">
        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow muted-eyebrow">YOUR ACCOUNT</span>
            <h1>Your orders, <em>{displayName || "buyer"}.</em></h1>
            <p>Review the orders placed with this account.</p>
          </div>
        </div>
        <section className="dashboard-panel buyer-orders-panel">
          <div className="panel-heading">
            <div><span className="eyebrow muted-eyebrow">ORDER HISTORY</span><h2>My orders <span>{orders.length}</span></h2></div>
          </div>
          {orders.length ? (
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead><tr><th>Order</th><th>Products</th><th>Total</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>#{order.id.slice(0, 8).toUpperCase()}</td>
                      <td>{order.order_items?.map((item) => `${item.product_title} × ${item.quantity}`).join(", ") || "—"}</td>
                      <td>{formatPrice(order.total_kobo)}</td>
                      <td>{new Date(order.created_at).toLocaleDateString("en-GH")}</td>
                      <td><span className={`status-pill ${order.status === "paid" ? "live" : "paused"}`}>{order.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="table-empty">Orders you place while signed in will appear here.</p>}
        </section>
      </section> : null}
    </Marketplace>
  );
}
