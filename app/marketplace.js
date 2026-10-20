"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBuyerCart } from "./buyer-cart-provider";
import SignOutButton from "./sign-out-button";

const productCategories = ["Building materials", "Tools", "Lighting", "Furniture", "Home & decor", "Other"];
const categories = ["All products", ...productCategories];
const storefrontPages = [
  { href: "/shop", label: "Shop", page: "shop" },
  { href: "/categories", label: "Categories", page: "categories" },
  { href: "/how-it-works", label: "How it works", page: "how-it-works" },
  { href: "/about", label: "About", page: "about" },
];
const SHIPPING_FEE_KOBO = 600;

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

function SellerDashboardLink({ className = "", onClick, compact = false }) {
  return (
    <Link
      className={`landing-seller-button${className ? ` ${className}` : ""}`}
      href="/dashboard/seller"
      aria-label="Go to the seller dashboard"
      onClick={onClick}
    >
      <svg className="landing-seller-icon" aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 13 2.2-6h17.6l2.2 6" />
        <path d="M5 13h22v2a3 3 0 0 1-5 2.2A3 3 0 0 1 16 17a3 3 0 0 1-6 0A3 3 0 0 1 5 15z" />
        <path d="M8 17v9h16v-9" />
        <path d="M12 26v-6h8v6" />
        <path d="m14 21 4 2" />
        <path d="m7 4 1.2-1M16 3V1M25 4l-1.2-1" stroke="#ffd166" />
      </svg>
      <span className="landing-seller-label">Become a seller</span>
      {compact ? <span className="landing-seller-label-mobile">Sell</span> : null}
      <span className="landing-seller-arrow" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 10h13M10 3.5 16.5 10 10 16.5" />
        </svg>
      </span>
    </Link>
  );
}

function ProductCard({ product, index, onAdd }) {
  return (
    <article className="product-card" key={product.id}>
      <div
        className={`product-image product-image-${index % 4}`}
        style={{ backgroundImage: `url("${product.image_url}")` }}
      />
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <div className="product-title-row">
          <h3>{product.title}</h3>
          <strong>{formatPrice(product.price_kobo)}</strong>
        </div>
        <button className="product-add-button" type="button" onClick={() => onAdd(product)}>
          Add to cart <span aria-hidden="true">+</span>
        </button>
      </div>
    </article>
  );
}

export default function Marketplace({ products, isConfigured, catalogError, buyerMode = false, dashboardHref = "", hideMarketplaceContent = false, page = "marketplace" }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);
  const [category, setCategory] = useState("All products");
  const { cart, setCart } = useBuyerCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState("");
  const isStorefrontPage = !buyerMode && (storefrontPages.some((item) => item.page === page) || page === "home");
  const pageDetails = {
    shop: "Shop the BuildMart catalogue",
    categories: "Shop by category",
    "how-it-works": "A simpler way to get started",
    about: "Good projects start close to home",
  }[page];

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
        (page === "shop" && !buyerMode) ||
        category === "All products" ||
        product.category === category;
      const matchesSearch =
        !term ||
        `${product.title} ${product.description} ${product.category}`
          .toLowerCase()
          .includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [buyerMode, category, page, products, search]);
  const filteredCategoryGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const availableCategories = [
      ...productCategories,
      ...new Set(products.map((product) => product.category).filter((item) => !productCategories.includes(item))),
    ];
    return availableCategories.map((name) => ({
      name,
      products: products.filter((product) => (
        product.category === name &&
        (!term || `${product.title} ${product.description} ${product.category}`.toLowerCase().includes(term))
      )),
    }));
  }, [products, search]);
  const cartTotal = cart.reduce(
    (total, item) => total + item.price_kobo * item.quantity,
    0,
  );
  const checkoutTotal = cartTotal + (cart.length ? SHIPPING_FEE_KOBO : 0);

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

  function removeFromCart(id) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  function beginCheckout() {
    setCheckoutState("");
    setCartOpen(false);
    router.push("/checkout");
  }

  return (
    <>
      <header id="top" className={`site-header${buyerMode ? " buyer-site-header" : ""}${isStorefrontPage ? " landing-site-header" : ""}${mobileMenuOpen ? " mobile-menu-open" : ""}`}>
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
              <nav id="site-navigation" className={`main-nav${isStorefrontPage ? " landing-main-nav" : ""}`} aria-label="Main navigation">
            {isStorefrontPage ? (
              <div className="mobile-menu-group">
                {storefrontPages.map((item) => (
                  <Link
                    href={item.href}
                    key={item.page}
                    aria-current={page === item.page ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
            {buyerMode ? (
              <div className="mobile-menu-group">
                <Link href="/dashboard/buyer/shop" aria-current="page" onClick={() => setMobileMenuOpen(false)}>Shop</Link>
              </div>
            ) : !isStorefrontPage ? (
              <>
                <div className="mobile-menu-group">
                  {!hideMarketplaceContent ? <Link href="/shop" onClick={() => setMobileMenuOpen(false)}>Shop</Link> : null}
                </div>
              </>
            ) : null}
            {dashboardHref ? (
              <Link href={dashboardHref} onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
            ) : null}
            {!buyerMode && !dashboardHref ? (
              <SellerDashboardLink
                className="seller-menu-link"
                onClick={() => setMobileMenuOpen(false)}
              />
            ) : null}
            {buyerMode || dashboardHref ? (
              <div className="mobile-navigation-signout"><SignOutButton /></div>
            ) : null}
              </nav>
              <div className="header-actions">
            {buyerMode || dashboardHref
              ? <span className="desktop-signout"><SignOutButton /></span>
              : null}
            {!buyerMode && !dashboardHref && !isStorefrontPage ? (
                <Link className="seller-cta desktop-seller-cta" href="/dashboard/seller" onClick={() => setMobileMenuOpen(false)}>Become a seller?</Link>
            ) : null}
            {isStorefrontPage ? (
              <SellerDashboardLink compact />
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

      <main className={`marketplace-main${buyerMode ? " buyer-marketplace" : ""}${isStorefrontPage ? " landing-marketplace-main" : ""}`}>
        {!hideMarketplaceContent ? (
          <>
        {page === "home" && !buyerMode ? (
            <section className="landing-hero">
              <div className="landing-hero-copy">
                <span className="landing-pill"><span aria-hidden="true" /> GHANA&apos;S HOME &amp; BUILD MARKETPLACE</span>
                <h1>Build better.<br />Live <em>beautifully.</em></h1>
                <p className="landing-hero-description">
                  Find the materials, tools and home essentials you need from local businesses — all in one place.
                </p>
                <div className="landing-hero-actions">
                  <Link className="landing-button landing-button-primary" href="/shop">
                    Shop products <span aria-hidden="true">↗</span>
                  </Link>
                  <Link className="landing-button landing-button-secondary" href="/categories">
                    Explore categories <span aria-hidden="true">↗</span>
                  </Link>
                </div>
                <div className="landing-hero-actions landing-secondary-actions">
                  <Link className="landing-text-link" href="/how-it-works">
                    <span className="landing-play-icon" aria-hidden="true">▶</span> How it works
                  </Link>
                  <Link className="landing-text-link" href="/about">About BuildMart <span aria-hidden="true">↗</span></Link>
                </div>
                <div className="landing-trust-points">
                  <span><i aria-hidden="true">✓</i> Ghanaian sellers</span>
                  <span><i aria-hidden="true">✓</i> Secure Paystack checkout</span>
                  <span><i aria-hidden="true">✓</i> Guest checkout</span>
                </div>
              </div>
              <div className="landing-showcase" role="img" aria-label="A home setting with product photos of building supplies, tools and furniture">
                <div className="landing-showcase-photo" />
                <div className="landing-category-card">
                  <Image src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=480&q=80" alt="" width={480} height={360} loading="lazy" unoptimized />
                </div>
                <div className="landing-secure-card">
                  <Image src="https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=480&q=80" alt="" width={480} height={360} loading="lazy" unoptimized />
                </div>
                <div className="landing-count-card">
                  <Image src="https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=480&q=80" alt="" width={480} height={360} loading="lazy" unoptimized />
                </div>
                <div className="landing-detail-photo" />
                <span className="landing-showcase-caption">Make room for what&apos;s next.</span>
              </div>
            </section>
        ) : null}
        {page === "shop" || buyerMode ? (
          <section className="shop-section storefront-products-page">
            <div className="storefront-page-heading">
              <span className="eyebrow muted-eyebrow">{buyerMode ? "YOUR MARKETPLACE" : "THE BUILD MART CATALOGUE"}</span>
              <h1>{buyerMode ? "Find your next good thing." : pageDetails}</h1>
              <p>Browse the full range of products from local sellers in one place.</p>
              <label className="search-field" id="product-search">
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Search products"
                  placeholder="Search products"
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>

            {buyerMode ? (
              <div className="category-tabs" role="group" aria-label="Filter products by category">
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
            ) : null}

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
              <>
                <p className="catalog-result-count">{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}</p>
                <div className="product-grid">
                  {filteredProducts.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} onAdd={addToCart} />
                  ))}
                </div>
              </>
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
        ) : null}

        {page === "categories" ? (
          <section className="shop-section storefront-categories-page">
            <div className="storefront-page-heading">
              <span className="eyebrow muted-eyebrow">EXPLORE THE RANGE</span>
              <h1>{pageDetails}</h1>
              <p>Find the right products for your build, renovation or home.</p>
              <label className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Search categories and products"
                  placeholder="Search categories and products"
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
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
            ) : (
              <>
                <nav className="category-index" aria-label="Jump to a product category">
                  {filteredCategoryGroups.map(({ name, products: groupProducts }) => (
                    <a className="category-index-link" href={`#category-${encodeURIComponent(name)}`} key={name}>
                      <span>{name}</span>
                      <small>{groupProducts.length}</small>
                      <span className="category-index-arrow" aria-hidden="true">↓</span>
                    </a>
                  ))}
                </nav>
                {filteredCategoryGroups.map(({ name, products: groupProducts }) => (
                  <section className="category-product-section" id={`category-${encodeURIComponent(name)}`} key={name}>
                    <div className="category-product-heading">
                      <div>
                        <span className="eyebrow muted-eyebrow">BUILD MART CATEGORY</span>
                        <h2>{name}</h2>
                      </div>
                      <span>{groupProducts.length} {groupProducts.length === 1 ? "product" : "products"}</span>
                    </div>
                    {groupProducts.length ? (
                      <div className="product-grid">
                        {groupProducts.map((product, index) => (
                          <ProductCard key={product.id} product={product} index={index} onAdd={addToCart} />
                        ))}
                      </div>
                    ) : (
                      <p className="category-empty-message">
                        {search ? "No products in this category match your search." : "New products in this category are coming soon."}
                      </p>
                    )}
                  </section>
                ))}
              </>
            )}
          </section>
        ) : null}

        {page === "how-it-works" ? (
          <section className="storefront-editorial-page">
            <div className="storefront-editorial-heading">
              <span className="eyebrow muted-eyebrow">HOW IT WORKS</span>
              <h1>{pageDetails}</h1>
              <p>From browsing to delivery, BuildMart keeps the process straightforward.</p>
            </div>
            <div className="storefront-steps">
              {[
                ["01", "Browse the marketplace", "Explore all products or browse by category to find materials, tools, lighting, furniture and home essentials."],
                ["02", "Add products to your cart", "Choose products from participating local sellers and review your selections in the cart."],
                ["03", "Enter delivery details", "At checkout, provide your contact information, recipient details and delivery address."],
                ["04", "Pay securely online", "Continue to Paystack to complete payment. Your order is confirmed after payment verification."],
              ].map(([number, title, description]) => (
                <article className="storefront-step" key={number}>
                  <span>{number}</span>
                  <div><h2>{title}</h2><p>{description}</p></div>
                </article>
              ))}
            </div>
            <div className="storefront-editorial-cta">
              <div><h2>Ready to find what you need?</h2><p>Explore the BuildMart catalogue and shop local.</p></div>
              <Link className="landing-button landing-button-primary" href="/shop">Browse all products <span aria-hidden="true">↗</span></Link>
            </div>
          </section>
        ) : null}

        {page === "about" ? (
          <section className="storefront-editorial-page">
            <div className="storefront-editorial-heading">
              <span className="eyebrow muted-eyebrow">ABOUT BUILDMART</span>
              <h1>{pageDetails}</h1>
              <p>A Ghana-focused marketplace connecting shoppers with local businesses for building and home projects.</p>
            </div>
            <div className="storefront-about-panel">
              <div className="storefront-about-mark" aria-hidden="true">B</div>
              <div>
                <h2>One place for the things that make a place.</h2>
                <p>
                  BuildMart brings together products from approved local sellers across building materials, tools, lighting, furniture, home &amp; decor, and other useful essentials. Shoppers can browse as guests, place an order with delivery details, and continue to secure online payment.
                </p>
                <p>
                  Sellers can apply to join the marketplace. Approved shops manage their own product listings and fulfil orders for the products they sell.
                </p>
              </div>
            </div>
            <div className="storefront-editorial-cta">
              <div><h2>Are you a local seller?</h2><p>Apply to bring your shop and products to BuildMart.</p></div>
              <Link className="landing-button landing-button-primary" href="/dashboard/seller">Become a seller <span aria-hidden="true">↗</span></Link>
            </div>
          </section>
        ) : null}

        {!isStorefrontPage && !buyerMode ? (
          <section className="shop-section storefront-products-page">
            <div className="storefront-page-heading">
              <h1>Find your next good thing.</h1>
              <p>Useful picks from sellers who know their craft.</p>
            </div>
            <div className="product-grid">
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} onAdd={addToCart} />
              ))}
            </div>
          </section>
        ) : null}

          </>
        ) : null}
      </main>

      {cartOpen ? (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside className="cart-drawer" aria-label="Shopping cart" role="dialog" aria-modal="true">
            <div className="drawer-heading">
              <div><h2>Your cart <span>({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h2></div>
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
                        <span>{formatPrice(item.price_kobo * item.quantity)}</span>
                        {item.quantity > 1 ? <small className="cart-item-unit-price">{formatPrice(item.price_kobo)} each</small> : null}
                        <div className="cart-item-controls">
                          <div className="quantity-controls">
                            <button type="button" aria-label={`Remove one ${item.title}`} onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button>
                            <span>{item.quantity}</span>
                            <button type="button" aria-label={`Add one ${item.title}`} onClick={() => setQuantity(item.id, item.quantity + 1)}>+</button>
                          </div>
                        </div>
                      </div>
                      <button className="cart-remove-button" type="button" onClick={() => removeFromCart(item.id)} aria-label={`Remove ${item.title} from cart`}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <section className="cart-checkout-summary" aria-label="Order summary">
                  <div className="cart-summary-line"><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div>
                  <div className="cart-summary-line"><span>Shipping</span><strong>{formatPrice(SHIPPING_FEE_KOBO)}</strong></div>
                  <div className="cart-summary-total"><span>Total</span><strong>{formatPrice(checkoutTotal)}</strong></div>
                  {checkoutState ? <p className="form-error" role="alert">{checkoutState}</p> : null}
                  <button className="button button-dark checkout-button" type="button" onClick={beginCheckout} disabled={!isConfigured}>
                    Checkout
                  </button>
                </section>
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
