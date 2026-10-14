"use client";

import { useState } from "react";

export default function AdminSellerApproval({ sellerId, initialStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateStatus(nextStatus) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/sellers/${sellerId}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Could not update seller approval.");
        return;
      }
      setStatus(result.status);
      setMessage(result.status === "approved" ? "Shop approved." : "Shop approval revoked.");
    } catch {
      setMessage("We couldn't connect to the seller service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isApproved = status === "approved";
  return (
    <div className="seller-approval">
      <span className={`status-pill ${isApproved ? "live" : "paused"}`}>
        {isApproved ? "Approved" : status === "rejected" ? "Rejected" : "Pending review"}
      </span>
      <button
        className="small-action"
        type="button"
        disabled={busy}
        onClick={() => updateStatus(isApproved ? "rejected" : "approved")}
      >
        {busy ? "Saving…" : isApproved ? "Suspend shop" : "Approve shop"}
      </button>
      {message ? <span className={message.startsWith("We couldn't") || message.startsWith("Could not") ? "payout-message" : "payout-message success"} role="status">{message}</span> : null}
    </div>
  );
}
