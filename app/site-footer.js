"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteFooter() {
  const pathname = usePathname();
  if (
    pathname === "/dashboard/seller/market" ||
    pathname === "/seller/login" ||
    pathname === "/seller/signup" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password"
  ) {
    return null;
  }

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="brand footer-brand" aria-label="BuildMart Ghana">
          <span className="mark brand-mark">B</span>
          <span>BuildMart<span className="brand-country">GH</span></span>
        </div>
        <nav className="footer-meta" aria-label="Footer navigation">
          <Link href="/shop">Shop</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/about">About</Link>
          <span>© {new Date().getFullYear()} BuildMart Ghana</span>
        </nav>
      </div>
    </footer>
  );
}
