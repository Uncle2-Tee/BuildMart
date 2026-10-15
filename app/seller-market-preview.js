"use client";

import Link from "next/link";
import { useState } from "react";

function formatPrice(priceKobo) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(priceKobo / 100);
}

export default function SellerMarketPreview({ products: initialProducts, shopName }) {
  const [products, setProducts] = useState(initialProducts);
  const [publishingId, setPublishingId] = useState("");
  const [message, setMessage] = useState("");

  async function publishProduct(product) {
    setPublishingId(product.id);
    setMessage("");

    try {
      const response = await fetch(`/api/seller/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || `We couldn't publish ${product.title}.`);
        return;
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, active: true } : item,
        ),
      );
      setMessage(`${product.title} is now live in the marketplace.`);
    } catch {
      setMessage("We couldn't connect to the publishing service. Please try again.");
    } finally {
      setPublishingId("");
    }
  }

  const unpublishedProducts = products.filter((product) => !product.active);

  return (
    <main className="seller-market-preview buyer-marketplace">
      <section className="seller-preview-heading">
        <span className="eyebrow muted-eyebrow">MARKET PREVIEW</span>
        <h1>See your shop as buyers will.</h1>
        <p>
          Review each product in the same card layout buyers see. Publish only
          when the details and image look right.
        </p>
        {shopName ? <span className="seller-preview-shop">{shopName}</span> : null}
      </section>

      {message ? (
        <p className="seller-preview-message" role="status">{message}</p>
      ) : null}

      {products.length ? (
        <>
          {unpublishedProducts.length ? (
            <section className="seller-preview-section" aria-labelledby="preview-drafts-title">
              <div className="seller-preview-section-heading">
                <div>
                  <span className="eyebrow muted-eyebrow">READY FOR YOUR REVIEW</span>
                  <h2 id="preview-drafts-title">Unpublished products <span>{unpublishedProducts.length}</span></h2>
                </div>
                <span className="seller-preview-hint">Only you can see these previews</span>
              </div>
              <div className="product-grid seller-preview-grid">
                {unpublishedProducts.map((product, index) => (
                  <article className="product-card seller-preview-card" key={product.id}>
                    <div
                      className={`product-image product-image-${index % 4}`}
                      style={{ backgroundImage: `url("${product.image_url}")` }}
                    >
                      <span className="product-tag">{product.category}</span>
                    </div>
                    <div className="product-info">
                      <div>
                        <h3>{product.title}</h3>
                        <span className="product-category">{product.category}</span>
                      </div>
                      <strong>{formatPrice(product.price_kobo)}</strong>
                    </div>
                    <button
                      className="button button-dark seller-publish-button"
                      type="button"
                      disabled={publishingId === product.id}
                      onClick={() => publishProduct(product)}
                    >
                      {publishingId === product.id ? "Publishing…" : "Publish to market"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {products.some((product) => product.active) ? (
            <section className="seller-preview-section" aria-labelledby="preview-live-title">
              <div className="seller-preview-section-heading">
                <div>
                  <span className="eyebrow muted-eyebrow">VISIBLE TO BUYERS</span>
                  <h2 id="preview-live-title">Live products <span>{products.filter((product) => product.active).length}</span></h2>
                </div>
                <Link className="seller-preview-link" href="/dashboard/seller">Manage products</Link>
              </div>
              <div className="product-grid seller-preview-grid">
                {products.filter((product) => product.active).map((product, index) => (
                  <article className="product-card seller-preview-card" key={product.id}>
                    <div
                      className={`product-image product-image-${index % 4}`}
                      style={{ backgroundImage: `url("${product.image_url}")` }}
                    >
                      <span className="product-tag">{product.category}</span>
                    </div>
                    <div className="product-info">
                      <div>
                        <h3>{product.title}</h3>
                        <span className="product-category">{product.category}</span>
                      </div>
                      <strong>{formatPrice(product.price_kobo)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="seller-preview-empty">
          <span className="seller-preview-empty-mark" aria-hidden="true">＋</span>
          <h2>Your preview is ready for its first product.</h2>
          <p>Add a product from your seller dashboard. It will appear here privately so you can review it before publishing.</p>
          <Link className="button button-dark" href="/dashboard/seller">Add a product</Link>
        </section>
      )}
    </main>
  );
}
