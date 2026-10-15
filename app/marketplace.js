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

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4.2 4.2" />
    </svg>
  );
}

export default function Marketplace({ products, isConfigured, catalogError, buyerMode = false, buyerPage = "home", buyerName = "", buyerEmail = "", dashboardHref = "" }) {
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

  function focusSearch() {
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchInputRef.current?.focus({ preventScroll: true });
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
          <Link className="brand" href="/" aria-label="BuildMart Ghana home">
            <Mark className="brand-mark">B</Mark>
            <span>BuildMart<span className="brand-country">GH</span></span>
          </Link>
          <nav id="site-navigation" className="main-nav" aria-label="Main navigation">
            {buyerMode ? (
              <>
                <Link href="/dashboard/buyer" aria-current={buyerPage === "home" ? "page" : undefined} onClick={() => setMobileMenuOpen(false)}>Home</Link>
                <Link href="/dashboard/buyer/shop" aria-current={buyerPage === "shop" ? "page" : undefined} onClick={() => setMobileMenuOpen(false)}>Shop</Link>
              </>
            ) : (
              <>
                <a href="#top" onClick={() => setMobileMenuOpen(false)}>Home</a>
                <a href="#shop" onClick={() => setMobileMenuOpen(false)}>Shop</a>
              </>
            )}
            {!buyerMode ? (
              <>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a>
                <a href="#for-sellers" onClick={() => setMobileMenuOpen(false)}>For sellers</a>
              </>
            ) : (
              <Link href="/dashboard/buyer/orders" aria-current={buyerPage === "orders" ? "page" : undefined} onClick={() => setMobileMenuOpen(false)}>My orders</Link>
            )}
            {dashboardHref ? (
              <Link href={dashboardHref} onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
            ) : !buyerMode ? (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Seller portal</Link>
            ) : null}
          </nav>
          <div className="header-actions">
            {buyerMode && buyerPage !== "shop" ? (
              <Link className="header-search-button" href="/dashboard/buyer/shop" aria-label="Search products">
                <SearchIcon />
              </Link>
            ) : (
              <button className="header-search-button" type="button" aria-label="Search products" onClick={focusSearch}>
                <SearchIcon />
              </button>
            )}
            {buyerMode || dashboardHref
              ? <SignOutButton />
              : <Link className="login-link" href="/login">Log in</Link>}
            {buyerMode || !dashboardHref ? (
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
        </div>
      </header>

      <main className={buyerMode ? "buyer-marketplace" : ""}>
        {buyerMode && buyerPage === "home" ? (
          <section className="buyer-welcome" id="buyer-home">
            <div className="buyer-welcome-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> GHANA&apos;S HOME & BUILD MARKETPLACE</span>
              <h1>Welcome back,<br /><em>{buyerName || "builder"}.</em></h1>
              <p>Find thoughtful picks for your next project, all from trusted Ghanaian businesses.</p>
              <div className="buyer-welcome-actions">
                <Link className="button button-light" href="/dashboard/buyer/shop">Explore the marketplace <span aria-hidden="true">↘</span></Link>
                <Link className="buyer-orders-link" href="/dashboard/buyer/orders">View my orders <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="buyer-welcome-art" aria-hidden="true">
              <span className="buyer-art-orbit buyer-art-orbit-one" />
              <span className="buyer-art-orbit buyer-art-orbit-two" />
              <div className="buyer-art-card buyer-art-card-back"><span>HOME</span><i /></div>
              <div className="buyer-art-card buyer-art-card-front"><span className="buyer-art-spark">✳</span><strong>Make room<br />for good things.</strong><small>LOCAL FINDS · MADE FOR YOU</small></div>
            </div>
            <div className="buyer-welcome-note"><span>01</span><strong>Good projects start close to home.</strong><span>Shop local. Build beautifully.</span></div>
          </section>
        ) : null}
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
        </section>

        <section className="benefits" id="how-it-works">
          <div className="benefit"><span className="benefit-icon">✳</span><span><strong>Local first</strong><small>Shop Ghanaian sellers</small></span></div>
          <div className="benefit"><span className="benefit-icon">⌂</span><span><strong>Made for your project</strong><small>From first brick to final touch</small></span></div>
          <div className="benefit"><span className="benefit-icon">✓</span><span><strong>Simple & secure</strong><small>Pay safely with Paystack</small></span></div>
          <div className="benefit"><span className="benefit-icon">♡</span><span><strong>People behind products</strong><small>Real businesses, real craft</small></span></div>
        </section>

        {(!buyerMode || buyerPage === "shop") ? <section className="shop-section" id="shop">
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
        </section> : null}

        {!buyerMode ? <section className="seller-banner" id="for-sellers">
          <div className="seller-banner-text">
            <span className="eyebrow">FOR GHANAIAN SELLERS</span>
            <h2>Your work deserves<br />a wider <em>market.</em></h2>
            <p>Set up your shop, list your products and reach people building a home they love.</p>
            <Link className="button button-light" href={dashboardHref || "/signup?role=seller"}>
              {dashboardHref ? "Open your dashboard" : "Open your seller shop"} <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="seller-banner-art" aria-hidden="true">
            <div className="art-sun" />
            <div className="art-building"><i /><i /><i /><i /><i /><i /></div>
            <div className="art-pot">✳</div>
          </div>
        </section> : null}
      </main>

      <footer className="site-footer">
        <Link className="brand footer-brand" href="/"><Mark className="brand-mark">B</Mark><span>BuildMart<span className="brand-country">GH</span></span></Link>
        <span>Better projects start close to home.</span>
        <div>{!buyerMode ? <Link href={dashboardHref || "/login"}>{dashboardHref ? "Dashboard" : "Seller portal"}</Link> : null}<span>© {new Date().getFullYear()} BuildMart Ghana</span></div>
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
