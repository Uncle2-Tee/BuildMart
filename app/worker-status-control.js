"use client";

import { useState } from "react";

export default function WorkerStatusControl({ initialActive, approved }) {
  const [active, setActive] = useState(initialActive);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function toggle() {
    if (!approved || busy) return;
    const nextActive = !active;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not update your availability.");
      setActive(result.active);
      setMessage(result.active ? "You are visible to customers." : "You are hidden from new bookings.");
    } catch (error) {
      setMessage(error.message || "We could not update your availability.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={`worker-status-control${active ? " is-active" : ""}`}>
    <div>
      <span className="worker-kicker">AVAILABILITY</span>
      <strong>{active ? "Active and visible" : "Inactive and hidden"}</strong>
      <p>{approved ? (active ? "Customers can find and request your services." : "Your profile is saved, but new customers cannot see it.") : "Availability becomes available after your profile is approved."}</p>
    </div>
    <button type="button" className="worker-status-toggle" aria-pressed={active} disabled={!approved || busy} onClick={toggle}>
      <span aria-hidden="true" />
      {busy ? "Updating…" : active ? "Set inactive" : "Set active"}
    </button>
    {message ? <small role="status">{message}</small> : null}
  </div>;
}
