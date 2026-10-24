"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SignOutButton from "./sign-out-button";

export default function DashboardHeader({
  displayName,
  admin = false,
  sellerDashboard = false,
  showMarketplaceLinks = true,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header id="dashboard-top" className={`dashboard-header${menuOpen ? " mobile-menu-open" : ""}`}>
      <Link className="brand" href="/" aria-label="BuildMart home">
        <span className="mark brand-mark">B</span>
        <span>BuildMart<span className="brand-country">GH</span></span>
      </Link>
      <div className={`dashboard-user${sellerDashboard ? " seller-dashboard-actions" : ""}`}>
        {sellerDashboard ? (
          <>
            <Link className="dashboard-seller-market-link" href="/shop">View market</Link>
            <SignOutButton admin={admin} />
          </>
        ) : (
          <>
            {admin ? <span className="admin-label">ADMINISTRATOR</span> : null}
            {showMarketplaceLinks && !admin ? <Link className="dashboard-home-link" href="/">Home</Link> : null}
            {showMarketplaceLinks ? <Link className="dashboard-marketplace-link" href="/">View marketplace ↗</Link> : null}
            {displayName ? <span className="user-avatar">{displayName.slice(0, 1).toUpperCase()}</span> : null}
            <SignOutButton />
          </>
        )}
      </div>
      {!sellerDashboard ? (
        <>
          <button
            className="mobile-menu-button dashboard-menu-button"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-controls="dashboard-mobile-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav id="dashboard-mobile-navigation" className="dashboard-mobile-navigation" aria-label="Dashboard navigation">
            {showMarketplaceLinks && !admin ? <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link> : null}
            {admin ? (
              <Link href="/" onClick={() => setMenuOpen(false)}>View market</Link>
            ) : (
              <a href="#dashboard-top" onClick={() => setMenuOpen(false)}>Dashboard</a>
            )}
            <div className="dashboard-mobile-signout"><SignOutButton admin={admin} /></div>
          </nav>
        </>
      ) : null}
    </header>
  );
}
