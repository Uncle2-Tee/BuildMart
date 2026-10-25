"use client";

import { useState } from "react";

export default function AdminShopApplicationApproval({ applicationId, initialStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateStatus(nextStatus) {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/shop-applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Could not update this shop application.");
        return;
      }

      setStatus(result.status);
      const decision = result.status === "approved" ? "Shop application approved." : "Shop application rejected.";
      setMessage(
        result.sellerNotified === true
          ? `${decision} Seller SMS notification submitted.`
          : result.sellerNotified === false
            ? `${decision} Seller SMS could not be sent. Check the seller's phone number and SMS configuration.`
            : decision,
      );
    } catch {
      setMessage("We couldn't connect to the application service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isPending = status === "pending";
  return (
    <div className="seller-approval application-approval">
      <span className={`status-pill ${status === "approved" ? "live" : "paused"}`}>
        {status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending review"}
      </span>
      {isPending ? (
        <div className="application-actions" aria-label="Shop application actions">
          <button
            className="application-action application-action-approve"
            type="button"
            disabled={busy}
            onClick={() => updateStatus("approved")}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="m5 10 3.2 3.2L15.5 6" />
            </svg>
            {busy ? "Saving…" : "Approve shop"}
          </button>
          <button
            className="application-action application-action-reject"
            type="button"
            disabled={busy}
            onClick={() => updateStatus("rejected")}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="m6 6 8 8m0-8-8 8" />
            </svg>
            Reject
          </button>
        </div>
      ) : null}
      {message ? <span className={`payout-message ${message.includes("could not be sent") || message.startsWith("We couldn't") || message.startsWith("Could not") ? "" : "success"}`} role="status">{message}</span> : null}
    </div>
  );
}
