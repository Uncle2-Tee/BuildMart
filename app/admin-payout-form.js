"use client";

import { useState } from "react";

export default function AdminPayoutForm({ sellerId, initialRecipientCode }) {
  const [code, setCode] = useState(initialRecipientCode ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/sellers/${sellerId}/payout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientCode: code }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Could not save payout details.");
        return;
      }

      setCode(result.recipientCode ?? "");
      setMessage(result.recipientCode ? "Transfer recipient saved." : "Transfer recipient removed.");
    } catch {
      setMessage("We couldn't connect to the payout service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="payout-form" onSubmit={save}>
      <label>
        Paystack transfer recipient code
        <input
          aria-label={`Paystack transfer recipient code for seller ${sellerId}`}
          autoComplete="off"
          maxLength={65}
          placeholder="RCP_..."
          value={code}
          onChange={(event) => setCode(event.target.value.trim())}
        />
      </label>
      <button className="small-action" type="submit" disabled={busy}>
        {busy ? "Saving…" : code ? "Save recipient" : "Remove recipient"}
      </button>
      {message ? <span className={message.includes("saved") || message.includes("removed") ? "payout-message success" : "payout-message"} role="status">{message}</span> : null}
    </form>
  );
}
