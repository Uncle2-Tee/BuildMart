"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminSellerApproval({ sellerId, initialStatus, hasShop }) {
  const router = useRouter();
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
      const decision = result.status === "approved" ? "Shop approved." : "Shop approval revoked.";
      setMessage(
        result.sellerNotification?.sent === true
          ? `${decision} Seller SMS accepted by the provider. Delivery is not guaranteed.`
          : result.sellerNotification?.sent === false
            ? `${decision} Seller SMS was not sent: ${result.sellerNotification.reason}`
            : decision,
      );
      router.refresh();
    } catch {
      setMessage("We couldn't connect to the seller service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isApproved = status === "approved";
  const isPendingShop = hasShop && status === "pending";
  return (
    <div className={`seller-approval${isPendingShop ? " seller-approval-pending" : ""}`}>
      <span className={`status-pill ${isApproved ? "live" : "paused"}`}>
        {!hasShop ? "No shop submitted" : isApproved ? "Approved" : status === "rejected" ? "Rejected" : "Pending review"}
      </span>
      {isPendingShop ? (
        <div className="application-actions seller-approval-actions" aria-label="Shop approval actions">
          <button
            className="application-action application-action-approve"
            type="button"
            disabled={busy}
            onClick={() => updateStatus("approved")}
          >
            {busy ? "Saving…" : "Approve"}
          </button>
          <button
            className="application-action application-action-reject"
            type="button"
            disabled={busy}
            onClick={() => updateStatus("rejected")}
          >
            {busy ? "Saving…" : "Decline"}
          </button>
        </div>
      ) : (
        <button
          className="small-action"
          type="button"
          disabled={busy || (!hasShop && status !== "approved")}
          onClick={() => updateStatus(isApproved ? "rejected" : "approved")}
        >
          {busy ? "Saving…" : !hasShop && !isApproved ? "Awaiting registration" : isApproved ? "Suspend shop" : "Approve shop"}
        </button>
      )}
      {message ? <span className={message.includes("was not sent:") || message.startsWith("We couldn't") || message.startsWith("Could not") ? "payout-message" : "payout-message success"} role="status">{message}</span> : null}
    </div>
  );
}
