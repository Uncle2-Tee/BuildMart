"use client";

import Link from "next/link";
import { useState } from "react";
import { useBuyerCart } from "../buyer-cart-provider";

const SHIPPING_FEE_KOBO = 600;
const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

function formatPrice(priceKobo) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(priceKobo / 100);
}

export default function CheckoutForm() {
  const { cart } = useBuyerCart();
  const [checkoutState, setCheckoutState] = useState("");
  const subtotal = cart.reduce(
    (total, item) => total + item.price_kobo * item.quantity,
    0,
  );
  const total = subtotal + (cart.length ? SHIPPING_FEE_KOBO : 0);

  async function placeOrder(event) {
    event.preventDefault();
    setCheckoutState("loading");

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          delivery: {
            name: form.get("delivery_name"),
            phone: form.get("delivery_phone"),
            region: form.get("delivery_region"),
            city: form.get("delivery_city"),
            address: form.get("delivery_address"),
            digitalAddress: form.get("delivery_digital_address"),
            instructions: form.get("delivery_instructions"),
          },
          items: cart.map(({ id, quantity }) => ({ productId: id, quantity })),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setCheckoutState(result.error || "We couldn't place your order. Please try again.");
        return;
      }

      if (!result.authorizationUrl) {
        setCheckoutState("The payment provider did not return a checkout link.");
        return;
      }

      window.location.assign(result.authorizationUrl);
    } catch {
      setCheckoutState("We couldn't connect to checkout. Please try again.");
    }
  }

  if (!cart.length) {
    return (
      <main className="checkout-page">
        <section className="checkout-empty">
          <span className="eyebrow muted-eyebrow">CHECKOUT</span>
          <h1>Your cart is empty</h1>
          <p>Add products to your cart before checking out.</p>
          <Link className="button button-dark" href="/">Back to shop</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="checkout-page-header">
        <Link className="checkout-back-link" href="/">← Back to shop</Link>
        <span className="checkout-step-label">SECURE CHECKOUT</span>
      </div>

      <div className="checkout-page-layout">
        <aside className="checkout-order-card" aria-label="Order summary">
          <h2>Order summary <span>({cart.reduce((sum, item) => sum + item.quantity, 0)} items)</span></h2>
          <div className="checkout-order-items">
            {cart.map((item) => (
              <div className="checkout-order-item" key={item.id}>
                <div className="checkout-order-image" style={{ backgroundImage: `url("${item.image_url}")` }} />
                <div className="checkout-order-copy">
                  <strong>{item.title}</strong>
                  <span>Qty {item.quantity}</span>
                </div>
                <strong className="checkout-order-price">{formatPrice(item.price_kobo * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <div className="checkout-order-totals">
            <div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
            <div><span>Shipping</span><strong>{formatPrice(SHIPPING_FEE_KOBO)}</strong></div>
            <div className="checkout-order-grand-total"><span>Total</span><strong>{formatPrice(total)}</strong></div>
          </div>
        </aside>

        <section className="checkout-details-card">
          <div className="checkout-page-title">
            <span className="eyebrow muted-eyebrow">CONTACT & DELIVERY</span>
            <p>Enter your contact and delivery details. We&apos;ll share delivery information with the sellers fulfilling your order.</p>
          </div>

          <form className="checkout-page-form" onSubmit={placeOrder}>
            <div className="delivery-fields">
              <label className="delivery-address-field">
                Email address
                <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
              </label>
              <label>
                Recipient name
                <input name="delivery_name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Name of person receiving the order" />
              </label>
              <label>
                Phone number
                <input name="delivery_phone" type="tel" autoComplete="tel" required minLength={7} maxLength={24} placeholder="e.g. 024 123 4567" />
              </label>
              <label>
                Region
                <select name="delivery_region" autoComplete="address-level1" required defaultValue="">
                  <option value="" disabled>Select region</option>
                  {GHANA_REGIONS.map((region) => <option key={region}>{region}</option>)}
                </select>
              </label>
              <label>
                City or town
                <input name="delivery_city" autoComplete="address-level2" required minLength={2} maxLength={100} placeholder="City, town or community" />
              </label>
              <label className="delivery-address-field">
                Street address and directions
                <textarea name="delivery_address" autoComplete="street-address" required minLength={5} maxLength={500} rows={3} placeholder="House number, street, landmark and directions for the rider" />
              </label>
              <label className="delivery-address-field">
                GhanaPost GPS address <span className="optional-field">(optional)</span>
                <input name="delivery_digital_address" autoComplete="off" maxLength={20} placeholder="e.g. GA-123-4567" />
              </label>
              <label className="delivery-address-field">
                Delivery instructions <span className="optional-field">(optional)</span>
                <textarea name="delivery_instructions" maxLength={500} rows={2} placeholder="Anything the seller or delivery rider should know?" />
              </label>
            </div>

            {checkoutState && checkoutState !== "loading" ? <p className="form-error" role="alert">{checkoutState}</p> : null}
            <button className="button button-dark checkout-place-order" type="submit" disabled={checkoutState === "loading"}>
              {checkoutState === "loading" ? "Preparing your order…" : "Place order"}
            </button>
            <p className="checkout-payment-note">No account needed. You&apos;ll continue to secure payment after placing your order.</p>
          </form>
        </section>

      </div>
    </main>
  );
}
