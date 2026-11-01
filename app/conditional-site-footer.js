"use client";

import { usePathname } from "next/navigation";
import SiteFooter from "./site-footer";

const formPagePaths = new Set([
  "/admin/login",
  "/buyer/login",
  "/buyer/signup",
  "/checkout",
  "/forgot-password",
  "/seller/login",
  "/seller/signup",
  "/worker/login",
  "/worker/signup",
  "/workers/rate",
]);

export default function ConditionalSiteFooter() {
  const pathname = usePathname();
  if (formPagePaths.has(pathname)) return null;
  return <SiteFooter />;
}
