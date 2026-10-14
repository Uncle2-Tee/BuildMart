"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminProductControls({ productId, initialActive }) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [message, setMessage] = useState("");

  async function updateProduct(method, body) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Could not update this product.");
        return;
      }

      if (method === "DELETE") {
        setRemoved(true);
      } else {
        setActive(result.product.active);
      }
      router.refresh();
    } catch {
      setMessage("We couldn't connect to the product service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (removed) return <span className="status-pill paused">Removed</span>;

  return (
    <div className="admin-product-controls">
      <button
        className="small-action"
        type="button"
        disabled={busy}
        onClick={() => updateProduct("PATCH", { active: !active })}
      >
        {busy ? "Saving…" : active ? "Hide" : "Show"}
      </button>
      <button
        className="small-action"
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm("Remove this product from the marketplace?")) {
            updateProduct("DELETE");
          }
        }}
      >
        Remove
      </button>
      {message ? <span className="payout-message" role="status">{message}</span> : null}
    </div>
  );
}
