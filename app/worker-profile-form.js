"use client";

import { useState } from "react";

const trades = ["Mason", "Painter", "Labourer", "Tiler", "Carpenter", "Electrician", "Plumber", "Welder", "Other"];

export default function WorkerProfileForm({ initialWorker }) {
  const [form, setForm] = useState({ name: initialWorker.name === "Worker" ? "" : initialWorker.name, trade: initialWorker.trade, bio: initialWorker.bio, location: initialWorker.location === "Ghana" ? "" : initialWorker.location, phone: initialWorker.phone === "Not provided" ? "" : initialWorker.phone, yearsExperience: initialWorker.years_experience, hourlyRate: initialWorker.hourly_rate_kobo ? initialWorker.hourly_rate_kobo / 100 : "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/worker/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setMessage("Profile submitted. An administrator will review it before it appears in the worker directory.");
    } catch (error) { setMessage(error.message || "Could not save your profile."); } finally { setBusy(false); }
  }
  return <form className="worker-profile-form" onSubmit={submit}>
    <div className="worker-profile-grid"><label>Full name<input name="name" required maxLength={100} value={form.name} onChange={update} /></label><label>Trade<select name="trade" value={form.trade} onChange={update}>{trades.map((trade) => <option key={trade}>{trade}</option>)}</select></label><label>Location<input name="location" required maxLength={120} value={form.location} onChange={update} placeholder="e.g. Accra, Ghana" /></label><label>Phone<input name="phone" required maxLength={30} value={form.phone} onChange={update} /></label><label>Years of experience<input name="yearsExperience" type="number" min="0" max="80" value={form.yearsExperience} onChange={update} /></label><label>Hourly rate (GHS)<input name="hourlyRate" type="number" min="1" step="0.01" value={form.hourlyRate} onChange={update} /></label><label className="worker-form-full">Professional bio<textarea name="bio" required minLength={20} maxLength={1000} rows={5} value={form.bio} onChange={update} placeholder="Tell customers what you do best." /></label></div>
    {message ? <p className="worker-form-message worker-form-success-message" role="status">{message}</p> : null}<button className="worker-primary-button" type="submit" disabled={busy}>{busy ? "Saving profile…" : "Submit profile for approval"}</button>
  </form>;
}
