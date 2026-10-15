"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SignOutButton from "./sign-out-button";

const categories = ["All products", "Building materials", "Tools", "Lighting", "Furniture", "Home & decor", "Other"];

function formatPrice(priceKobo) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(priceKobo / 100);
}

function Mark({ children, className = "" }) {
  return <span className={`mark ${className}`}>{children}</span>;
}

export default function Marketplace({ products, isConfigured, catalogError, buyerMode = false, buyerEmail = "" }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All products");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [email, setEmail] = useState(buyerEmail);
  const [checkoutState, setCheckoutState] = useState("");

  useEffect(() => {
    if (!cartOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cartOpen]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        category === "All products" || product.category === category;
      const matchesSearch =
        !term ||
        `${product.title} ${product.description} ${product.category}`
          .toLowerCase()
          .includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [category, products, search]);

  const cartTotal = cart.reduce(
    (total, item) => total + item.price_kobo * item.quantity,
    0,
  );

  function addToCart(product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, 99) }
            : item,
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function setQuantity(id, quantity) {
    setCart((current) =>
      quantity < 1
        ? current.filter((item) => item.id !== id)
        : current.map((item) =>
            item.id === id ? { ...item, quantity: Math.min(quantity, 99) } : item,
          ),
    );
  }

  async function checkout(event) {
    event.preventDefault();
    setCheckoutState("loading");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          items: cart.map(({ id, quantity }) => ({ productId: id, quantity })),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setCheckoutState(result.error || "We couldn't start checkout. Please try again.");
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

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="BuildMart Ghana home">
            <Mark className="brand-mark">B</Mark>
            <span>buildmart<span className="brand-country">GH</span></span>
          </Link>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#shop">Shop</a>
            {!buyerMode ? <><a href="#how-it-works">How it works</a><a href="#for-sellers">For sellers</a></> : null}
          </nav>
          <div className="header-actions">
            {buyerMode ? (
              <>
                <Link className="login-link" href="#buyer-orders">My orders</Link>
                <SignOutButton />
              </>
            ) : <Link className="login-link" href="/login">Log in</Link>}
            <button
              className="cart-button"
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart, ${cart.reduce((sum, item) => sum + item.quantity, 0)} items`}
            >
              <span aria-hidden="true">Bag</span>
              <span className="cart-count">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className={buyerMode ? "buyer-marketplace" : ""}>
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow"><span className="eyebrow-dot" /> GHANA&apos;S HOME & BUILD MARKETPLACE</span>
            <h1>Good things<br />are built <em>together.</em></h1>
            <p className="hero-copy">
              Find the materials, tools and home finds you need — from trusted
              local businesses, all in one place.
            </p>
            <a className="button button-dark" href="#shop">
              Explore the marketplace <span aria-hidden="true">↗</span>
            </a>
            <div className="hero-trust">
              <span className="trust-avatars" aria-hidden="true"><i>AK</i><i>JM</i><i>EF</i></span>
              <span>Built for Ghana. Backed by local businesses.</span>
            </div>
          </div>
          <div className="hero-image" role="img" aria-label="A warm, contemporary Ghanaian home interior">
            <div className="hero-image-note">
              <span className="note-spark">✳</span>
              <span><strong>Thoughtfully sourced</strong><small>Made for the way we live</small></span>
            </div>
            <span className="hero-image-caption">A home, made your own.</span>
          </div>
          <div className="hero-side-note" aria-hidden="true">ACCRA · KUMASI · TAKORADI</div>
        </section>

        <section className="benefits" id="how-it-works">
          <div className="benefit"><span className="benefit-icon">✳</span><span><strong>Local first</strong><small>Shop Ghanaian sellers</small></span></div>
          <div className="benefit"><span className="benefit-icon">⌂</span><span><strong>Made for your project</strong><small>From first brick to final touch</small></span></div>
          <div className="benefit"><span className="benefit-icon">✓</span><span><strong>Simple & secure</strong><small>Pay safely with Paystack</small></span></div>
          <div className="benefit"><span className="benefit-icon">♡</span><span><strong>People behind products</strong><small>Real businesses, real craft</small></span></div>
        </section>

        <section className="shop-section" id="shop">
          <div className="section-heading">
            <div>
              <span className="eyebrow muted-eyebrow">THE MARKETPLACE</span>
              <h2>Find your next <em>good thing.</em></h2>
              <p>Useful, lasting picks from sellers who know their craft.</p>
            </div>
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search products"
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
          </div>

          <div className="category-tabs" role="group" aria-label="Filter by category">
            {categories.map((item) => (
              <button
                className={category === item ? "category-tab selected" : "category-tab"}
                key={item}
                type="button"
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {!isConfigured ? (
            <div className="catalog-notice">
              <strong>Marketplace setup in progress</strong>
              <span>Add the Supabase settings and apply the included database migration to publish the catalogue.</span>
            </div>
          ) : catalogError ? (
            <div className="catalog-notice" role="alert">
              <strong>We couldn&apos;t load the catalogue.</strong>
              <span>Please try again shortly.</span>
            </div>
          ) : filteredProducts.length ? (
            <div className="product-grid">
              {filteredProducts.map((product, index) => (
                <article className="product-card" key={product.id}>
                  <div
                    className={`product-image product-image-${index % 4}`}
                    style={{ backgroundImage: `url("${product.image_url}")` }}
                  >
                    <span className="product-tag">{product.category}</span>
                    <button
                      className="quick-add"
                      type="button"
                      onClick={() => addToCart(product)}
                      aria-label={`Add ${product.title} to cart`}
                    >+</button>
                  </div>
                  <div className="product-info">
                    <div><h3>{product.title}</h3><span className="product-category">{product.category}</span></div>
                    <strong>{formatPrice(product.price_kobo)}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">✳</span>
              <h3>{products.length ? "No matches just yet." : "Good things are on the way."}</h3>
              <p>{products.length ? "Try a different search or category." : "Local sellers are getting their shops ready. Check back soon."}</p>
              {search || category !== "All products" ? (
                <button className="text-button" type="button" onClick={() => { setSearch(""); setCategory("All products"); }}>
                  Clear filters
                </button>
              ) : null}
            </div>
          )}
        </section>

        {!buyerMode ? <section className="seller-banner" id="for-sellers">
          <div className="seller-banner-text">
            <span className="eyebrow">FOR GHANAIAN SELLERS</span>
            <h2>Your work deserves<br />a wider <em>market.</em></h2>
            <p>Set up your shop, list your products and reach people building a home they love.</p>
            <Link className="button button-light" href="/signup?role=seller">Open your seller shop <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="seller-banner-art" aria-hidden="true">
            <div className="art-sun" />
            <div className="art-building"><i /><i /><i /><i /><i /><i /></div>
            <div className="art-pot">✳</div>
          </div>
        </section> : null}
      </main>

      <footer className="site-footer">
        <Link className="brand footer-brand" href="/"><Mark className="brand-mark">B</Mark><span>buildmart<span className="brand-country">GH</span></span></Link>
        <span>Better projects start close to home.</span>
        <div>{!buyerMode ? <Link href="/login">Seller portal</Link> : null}<span>© {new Date().getFullYear()} BuildMart Ghana</span></div>
      </footer>

      {cartOpen ? (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside className="cart-drawer" aria-label="Shopping cart" role="dialog" aria-modal="true">
            <div className="drawer-heading">
              <div><span className="eyebrow muted-eyebrow">YOUR SELECTION</span><h2>Your bag <span>({cart.length})</span></h2></div>
              <button className="close-button" type="button" aria-label="Close cart" onClick={() => setCartOpen(false)}>×</button>
            </div>
            {cart.length ? (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-item-image" style={{ backgroundImage: `url("${item.image_url}")` }} />
                      <div className="cart-item-copy">
                        <strong>{item.title}</strong>
                        <span>{formatPrice(item.price_kobo)}</span>
                        <div className="quantity-controls">
                          <button type="button" aria-label={`Remove one ${item.title}`} onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button>
                          <span>{item.quantity}</span>
                          <button type="button" aria-label={`Add one ${item.title}`} onClick={() => setQuantity(item.id, item.quantity + 1)}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <form className="checkout-form" onSubmit={checkout}>
                  <label htmlFor="buyer-email">Email for your receipt</label>
                  <input id="buyer-email" type="email" autoComplete="email" required readOnly={buyerMode} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                  <div className="cart-total"><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div>
                  <p className="checkout-note">Secure checkout powered by Paystack. Delivery details are arranged with the seller.</p>
                  {checkoutState && checkoutState !== "loading" ? <p className="form-error" role="alert">{checkoutState}</p> : null}
                  <button className="button button-dark checkout-button" type="submit" disabled={checkoutState === "loading" || !isConfigured}>
                    {checkoutState === "loading" ? "Opening secure checkout…" : "Continue to payment"}
                    <span aria-hidden="true">↗</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="empty-cart"><span>✳</span><h3>Your bag is taking a breather.</h3><p>Add something lovely from the marketplace.</p><button className="button button-dark" type="button" onClick={() => setCartOpen(false)}>Keep exploring</button></div>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
