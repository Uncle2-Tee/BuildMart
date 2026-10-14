"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SignOutButton from "./sign-out-button";

function formatPrice(priceKobo) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(priceKobo / 100);
}

export default function SellerDashboard({ displayName, products: initialProducts, orders }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState("");

  async function addProduct(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/seller/products", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "We couldn't publish your product.");
        return;
      }

      setProducts((current) => [result.product, ...current]);
      event.currentTarget.reset();
      setMessage("Your product is live in the marketplace.");
      router.refresh();
    } catch {
      setMessage("We couldn't connect to the product service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleProduct(product) {
    setMessage("");

    try {
      const response = await fetch(`/api/seller/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !product.active }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "We couldn't update that product.");
        return;
      }
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, active: result.product.active } : item));
    } catch {
      setMessage("We couldn't connect to the product service. Please try again.");
    }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Remove "${product.title}" from your shop?`)) return;

    setRemovingId(product.id);
    setMessage("");
    try {
      const response = await fetch(`/api/seller/products/${product.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "We couldn't remove that product.");
        return;
      }

      setProducts((current) => current.filter((item) => item.id !== product.id));
      setMessage(result.warning || "Product removed from your shop.");
    } catch {
      setMessage("We couldn't connect to the product service. Please try again.");
    } finally {
      setRemovingId("");
    }
  }

  const activeProducts = products.filter((product) => product.active).length;
  const paidOrders = orders.filter((order) => order.status === "paid");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/"><span className="mark brand-mark">B</span><span>buildmart<span className="brand-country">GH</span></span></Link>
        <div className="dashboard-user"><Link href="/">View marketplace ↗</Link><span className="user-avatar">{(displayName || "S").slice(0, 1).toUpperCase()}</span><SignOutButton /></div>
      </header>
      <section className="dashboard-welcome">
        <div><span className="eyebrow muted-eyebrow">SELLER SPACE</span><h1>Good to have you, <em>{displayName || "seller"}.</em></h1><p>Your shop, products and orders — all in one place.</p></div>
        <span className="dashboard-date">{new Intl.DateTimeFormat("en-GH", { dateStyle: "full" }).format(new Date())}</span>
      </section>
      <section className="stat-grid" aria-label="Shop summary">
        <div className="stat-card"><span>Live products</span><strong>{activeProducts}</strong><small>Visible in the marketplace</small></div>
        <div className="stat-card"><span>Products listed</span><strong>{products.length}</strong><small>Across your shop</small></div>
        <div className="stat-card"><span>Paid orders</span><strong>{paidOrders.length}</strong><small>Orders with confirmed payment</small></div>
      </section>
      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">YOUR CATALOGUE</span><h2>Products <span>{products.length}</span></h2></div></div>
          {message ? <p className={message.includes("couldn't") ? "form-error" : "success-message"} role="status">{message}</p> : null}
          {products.length ? (
            <div className="seller-product-list">
              {products.map((product) => (
                <article className="seller-product" key={product.id}>
                  <div className="seller-product-image" style={{ backgroundImage: `url("${product.image_url}")` }} />
                  <div className="seller-product-copy"><strong>{product.title}</strong><span>{product.category} · {formatPrice(product.price_kobo)}</span></div>
                  <span className={product.active ? "status-pill live" : "status-pill paused"}>{product.active ? "Live" : "Hidden"}</span>
                  <button className="small-action" type="button" onClick={() => toggleProduct(product)}>{product.active ? "Hide" : "Show"}</button>
                  <button className="small-action" type="button" onClick={() => removeProduct(product)} disabled={removingId === product.id}>{removingId === product.id ? "Removing…" : "Remove"}</button>
                </article>
              ))}
            </div>
          ) : <div className="dashboard-empty"><h3>Your shop is ready for its first product.</h3><p>Start with a clear title, a helpful description and a bright photo.</p></div>}
        </section>
        <section className="dashboard-panel add-product-panel">
          <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">ADD TO YOUR SHOP</span><h2>New product</h2></div></div>
          <form className="product-form" onSubmit={addProduct}>
            <label>Product name<input name="title" required minLength={3} maxLength={120} placeholder="e.g. Solid teak dining table" /></label>
            <label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose a category</option><option>Building materials</option><option>Tools</option><option>Lighting</option><option>Furniture</option><option>Home & decor</option><option>Other</option></select></label>
            <label>Price (GHS)<input name="price" type="number" required min="0.01" max="10000000" step="0.01" placeholder="0.00" /></label>
            <label>Description<textarea name="description" rows="3" maxLength={2000} placeholder="Tell customers what makes this product useful." /></label>
            <label className="photo-input">Product photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /><small>JPG, PNG or WebP · maximum 5 MB</small></label>
            <button className="button button-dark account-submit" type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish product"}<span aria-hidden="true">↗</span></button>
          </form>
        </section>
      </div>
      <section className="dashboard-panel orders-panel">
        <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">RECENT ACTIVITY</span><h2>Orders <span>{orders.length}</span></h2></div></div>
        {orders.length ? (
          <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>Order</th><th>Buyer</th><th>Products</th><th>Total</th><th>Status</th></tr></thead><tbody>
            {orders.map((order) => (
              <tr key={order.id}><td>#{order.id.slice(0, 8).toUpperCase()}</td><td>{order.buyer_email}</td><td>{order.order_items?.map((item) => `${item.product_title} × ${item.quantity}`).join(", ") || "—"}</td><td>{formatPrice((order.order_items ?? []).reduce((sum, item) => sum + item.unit_price_kobo * item.quantity, 0))}</td><td><span className={`status-pill ${order.status === "paid" ? "live" : "paused"}`}>{order.status}</span></td></tr>
            ))}
          </tbody></table></div>
        ) : <p className="table-empty">Your orders will show here after customers check out.</p>}
        <p className="seller-order-note">Orders only include your products. Paystack sends 90% of your product sales to your verified seller account; BuildMart retains a 10% platform commission and covers Paystack fees.</p>
      </section>
    </main>
  );
}
