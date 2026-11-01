"use client";

import { useState } from "react";

export default function AdminWorkerApproval({ workerId, initialStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function update(nextStatus) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/workers/${workerId}/approval`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update worker approval.");
      setStatus(result.status); setMessage(`Worker ${nextStatus}.`);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  return <div className="admin-worker-approval"><span className={`status-pill ${status === "approved" ? "live" : status === "rejected" ? "paused" : ""}`}>{status}</span>{status !== "approved" ? <button className="small-action" type="button" disabled={busy} onClick={() => update("approved")}>Approve</button> : <button className="small-action" type="button" disabled={busy} onClick={() => update("rejected")}>Pause</button>}{message ? <small role="status">{message}</small> : null}</div>;
}
