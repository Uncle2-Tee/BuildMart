"use client";

import Link from "next/link";
import { useState } from "react";

const orderFilters = [
  { id: "all", label: "All orders" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Awaiting payment" },
  { id: "failed", label: "Not completed" },
];

function getStatus(status) {
  if (status === "paid") return { label: "Paid", tone: "paid", filter: "paid" };
  if (status === "pending") return { label: "Awaiting payment", tone: "pending", filter: "pending" };
  if (status === "checkout_failed" || status === "failed") {
    return { label: "Payment not completed", tone: "failed", filter: "failed" };
  }

  return {
    label: String(status || "Unknown").replaceAll("_", " "),
    tone: "neutral",
    filter: "other",
  };
}

function formatPrice(priceKobo) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format((priceKobo || 0) / 100);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default function BuyerOrders({ orders, displayName }) {
  const [activeFilter, setActiveFilter] = useState("all");
  const paidCount = orders.filter((order) => order.status === "paid").length;
  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const failedCount = orders.filter((order) => getStatus(order.status).filter === "failed").length;
  const visibleOrders = activeFilter === "all"
    ? orders
    : orders.filter((order) => getStatus(order.status).filter === activeFilter);
  const counts = {
    all: orders.length,
    paid: paidCount,
    pending: pendingCount,
    failed: failedCount,
  };

  return (
    <section className="dashboard-shell buyer-orders" id="buyer-orders">
      <header className="buyer-orders-heading">
        <div>
          <span className="eyebrow muted-eyebrow">ORDER HISTORY</span>
          <h1>My orders</h1>
          <p>Review your purchases and payment updates{displayName ? `, ${displayName}` : ""}.</p>
        </div>
        <Link className="buyer-orders-shop-link" href="/dashboard/buyer/shop">
          <span aria-hidden="true">←</span> Continue shopping
        </Link>
      </header>

      <div className="buyer-order-summary" aria-label="Order summary">
        <div><span>Total orders</span><strong>{orders.length}</strong></div>
        <div><span>Paid</span><strong>{paidCount}</strong></div>
        <div><span>Awaiting payment</span><strong>{pendingCount}</strong></div>
      </div>

      <section className="buyer-orders-panel" aria-labelledby="buyer-orders-title">
        <div className="buyer-orders-toolbar">
          <div>
            <span className="eyebrow muted-eyebrow">YOUR ACCOUNT</span>
            <h2 id="buyer-orders-title">Recent orders</h2>
          </div>
          {orders.length ? (
            <div className="buyer-order-filters" role="group" aria-label="Filter orders by payment status">
              {orderFilters.map((filter) => (
                <button
                  aria-pressed={activeFilter === filter.id}
                  className={activeFilter === filter.id ? "buyer-order-filter active" : "buyer-order-filter"}
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  type="button"
                >
                  {filter.label} <span>{counts[filter.id]}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {visibleOrders.length ? (
          <div className="buyer-order-list">
            {visibleOrders.map((order) => {
              const status = getStatus(order.status);
              const items = order.order_items ?? [];

              return (
                <article className="buyer-order-row" key={order.id}>
                  <div className="buyer-order-main">
                    <div className="buyer-order-meta">
                      <span className="buyer-order-number">Order #{order.id.slice(0, 8).toUpperCase()}</span>
                      <time dateTime={order.created_at}>{formatDate(order.created_at)}</time>
                    </div>
                    <ul className="buyer-order-items">
                      {items.slice(0, 3).map((item, index) => (
                        <li key={`${order.id}-${index}`}>
                          <span>{item.product_title}</span><span>× {item.quantity}</span>
                        </li>
                      ))}
                      {items.length > 3 ? <li className="buyer-order-more">+ {items.length - 3} more items</li> : null}
                      {!items.length ? <li className="buyer-order-more">Order details unavailable</li> : null}
                    </ul>
                  </div>
                  <div className="buyer-order-total">
                    <span>Total</span>
                    <strong>{formatPrice(order.total_kobo)}</strong>
                  </div>
                  <span className={`buyer-order-status ${status.tone}`}>{status.label}</span>
                </article>
              );
            })}
          </div>
        ) : orders.length ? (
          <div className="buyer-orders-empty" role="status">
            <strong>No {activeFilter === "failed" ? "incomplete" : activeFilter} orders</strong>
            <span>Try another payment status filter.</span>
          </div>
        ) : (
          <div className="buyer-orders-empty">
            <strong>Your order history starts here.</strong>
            <span>Orders you place while signed in will appear here.</span>
            <Link href="/dashboard/buyer/shop">Browse the shop <span aria-hidden="true">↗</span></Link>
          </div>
        )}
      </section>
    </section>
  );
}