import Link from "next/link";

export default function SellerMarketLoading() {
  return (
    <>
      <header className="site-header seller-market-header">
        <div className="header-inner">
          <Link
            className="market-back-button"
            href="/dashboard/seller"
            prefetch
            aria-label="Back to seller dashboard"
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </header>
      <main className="seller-market-preview seller-market-loading" aria-busy="true" aria-label="Loading market preview">
        <div className="seller-preview-heading">
          <span className="eyebrow muted-eyebrow">MARKET PREVIEW</span>
          <h1>Loading your shop preview…</h1>
        </div>
        <div className="product-grid seller-preview-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="seller-preview-loading-card" key={index}>
              <div className="seller-preview-loading-image" />
              <div className="seller-preview-loading-line" />
              <div className="seller-preview-loading-line short" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
