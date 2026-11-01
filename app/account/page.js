import Link from "next/link";
import DashboardHeader from "../dashboard-header";
import SignOutButton from "../sign-out-button";
import { requireRole } from "../../lib/auth";

export const metadata = {
  title: "My account | BuildMart Ghana",
};

function formatPrice(priceKobo) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format((priceKobo ?? 0) / 100);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AccountPage() {
  const { supabase, user, profile } = await requireRole(["buyer"], {
    loginRedirect: "/buyer/login",
  });
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, status, total_kobo, currency, created_at, delivery_name, delivery_phone, delivery_region, delivery_city, delivery_address, delivery_digital_address, order_items(product_title, quantity, unit_price_kobo)")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Unable to load buyer orders: ${error.message}`);
  }

  return (
    <main className="dashboard-shell buyer-account-shell">
      <DashboardHeader displayName={profile.display_name} showMarketplaceLinks />
      <div className="buyer-account-content">
        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">BUYER ACCOUNT</span>
            <h1>Welcome back, <em>{profile.display_name || "Buyer"}</em></h1>
            <p>Keep your account details and BuildMart purchases together.</p>
          </div>
          <Link className="button button-dark buyer-account-shop-link" href="/dashboard/buyer/shop">Continue shopping</Link>
        </div>
        <div className="buyer-account-grid">
          <section className="dashboard-panel buyer-details-card">
            <span className="eyebrow">ACCOUNT DETAILS</span>
            <h2>{profile.display_name || "Buyer"}</h2>
            <dl>
              <div><dt>Email</dt><dd>{user.email || "Not available"}</dd></div>
              <div><dt>Account type</dt><dd>Buyer</dd></div>
            </dl>
            <SignOutButton />
          </section>
          <section className="dashboard-panel buyer-orders-panel">
            <div className="buyer-orders-heading">
              <div>
                <span className="eyebrow">ORDER HISTORY</span>
                <h2>Your orders</h2>
              </div>
              <strong>{orders?.length ?? 0}</strong>
            </div>
            {!orders?.length ? (
              <div className="buyer-orders-empty">
                <p>You have not placed an order from this account yet.</p>
                <Link href="/dashboard/buyer/shop">Browse the marketplace</Link>
              </div>
            ) : (
              <div className="buyer-order-list">
                {orders.map((order) => (
                  <article className="buyer-order-card" key={order.id}>
                    <div className="buyer-order-header">
                      <div>
                        <strong>Order #{order.id.slice(0, 8).toUpperCase()}</strong>
                        <small>{formatDate(order.created_at)}</small>
                      </div>
                      <span className={`status-pill status-${order.status}`}>{order.status}</span>
                    </div>
                    <ul>
                      {(order.order_items ?? []).map((item, index) => (
                        <li key={`${order.id}-${index}`}>
                          <span>{item.product_title} × {item.quantity}</span>
                          <strong>{formatPrice(item.unit_price_kobo * item.quantity)}</strong>
                        </li>
                      ))}
                    </ul>
                    <div className="buyer-order-footer">
                      <span>Deliver to {order.delivery_city}, {order.delivery_region}</span>
                      <strong>{formatPrice(order.total_kobo)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
