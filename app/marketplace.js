"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBuyerCart } from "./buyer-cart-provider";
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

export default function Marketplace({ products, isConfigured, catalogError, buyerMode = false, buyerEmail = "", dashboardHref = "", hideMarketplaceContent = false, shopFirst = false }) {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);
  const [category, setCategory] = useState("All products");
  const { cart, setCart } = useBuyerCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState(buyerEmail);
  const [checkoutState, setCheckoutState] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setCartOpen(false);
      setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      <header id="top" className={`site-header${buyerMode ? " buyer-site-header" : ""}${mobileMenuOpen ? " mobile-menu-open" : ""}`}>
        <div className="header-inner">
          {hideMarketplaceContent ? (
            <Link
              className="market-back-button"
              href={dashboardHref}
              aria-label="Back to seller dashboard"
            >
              <span aria-hidden="true">←</span>
            </Link>
          ) : (
            <>
              <Link className="brand" href="/" aria-label="BuildMart Ghana home">
                <Mark className="brand-mark">B</Mark>
                <span>BuildMart<span className="brand-country">GH</span></span>
              </Link>
              <nav id="site-navigation" className="main-nav" aria-label="Main navigation">
            {buyerMode ? (
              <div className="mobile-menu-group">
                <Link href="/dashboard/buyer/shop" aria-current="page" onClick={() => setMobileMenuOpen(false)}>Shop</Link>
              </div>
            ) : (
              <>
                <div className="mobile-menu-group">
                  {!hideMarketplaceContent ? <a href="#shop" onClick={() => setMobileMenuOpen(false)}>Shop</a> : null}
                </div>
              </>
            )}
            {dashboardHref ? (
              <Link href={dashboardHref} onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
            ) : null}
            {!buyerMode && !dashboardHref ? (
                <Link className="seller-menu-link" href="/dashboard/seller" onClick={() => setMobileMenuOpen(false)}>Become a seller?</Link>
            ) : null}
            {buyerMode || dashboardHref ? (
              <div className="mobile-navigation-signout"><SignOutButton /></div>
            ) : null}
              </nav>
              <div className="header-actions">
            {buyerMode || dashboardHref
              ? <span className="desktop-signout"><SignOutButton /></span>
              : null}
            {!buyerMode && !dashboardHref ? (
                <Link className="seller-cta desktop-seller-cta" href="/dashboard/seller" onClick={() => setMobileMenuOpen(false)}>Become a seller?</Link>
            ) : null}
            {buyerMode || !dashboardHref ? (
              <button
                className="cart-button"
                type="button"
                onClick={() => setCartOpen(true)}
                aria-label={`Open cart, ${cart.reduce((sum, item) => sum + item.quantity, 0)} items`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="17" cy="18" r="1.5" />
                  <path d="M3 4h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.76L20 7H6" />
                </svg>
                <span className="cart-count">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </button>
            ) : null}
            <button
              className="mobile-menu-button"
              type="button"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-controls="site-navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className={`marketplace-main${buyerMode ? " buyer-marketplace" : ""}`}>
        {!hideMarketplaceContent ? (
          <>
        {!buyerMode && !shopFirst ? <section className="hero">
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
        </section> : null}

        {!buyerMode && !shopFirst ? <section className="benefits" id="how-it-works">
          <div className="benefit"><span className="benefit-icon">✳</span><span><strong>Local first</strong><small>Shop Ghanaian sellers</small></span></div>
          <div className="benefit"><span className="benefit-icon">⌂</span><span><strong>Made for your project</strong><small>From first brick to final touch</small></span></div>
          <div className="benefit"><span className="benefit-icon">✓</span><span><strong>Simple & secure</strong><small>Pay safely with Paystack</small></span></div>
          <div className="benefit"><span className="benefit-icon">♡</span><span><strong>People behind products</strong><small>Real businesses, real craft</small></span></div>
        </section> : null}

        <section className="shop-section" id="shop">
          <div className="section-heading">
            <div>
              {!buyerMode ? <span className="eyebrow muted-eyebrow">THE MARKETPLACE</span> : null}
              <h2>Find your next <em>good thing.</em></h2>
              <p>Useful, lasting picks from sellers who know their craft.</p>
            </div>
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search products"
                placeholder="Search products"
                ref={searchInputRef}
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

          </>
        ) : null}
      </main>

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
