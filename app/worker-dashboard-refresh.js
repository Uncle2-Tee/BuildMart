"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30 * 1000;

export default function WorkerDashboardRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefreshAt = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAt < 1000) return;
      lastRefreshAt = Date.now();
      router.refresh();
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
