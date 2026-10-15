"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteFooter() {
  const pathname = usePathname();
  if (
    pathname === "/dashboard/seller/market" ||
    pathname === "/login" ||
    pathname === "/signup"
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
        <p className="footer-tagline">Better projects start close to home.</p>
        <div className="footer-meta">
          <Link href="/login">Seller portal</Link>
          <span>© {new Date().getFullYear()} BuildMart Ghana</span>
        </div>
      </div>
    </footer>
  );
}
