"use client";

import { useState } from "react";

const trades = ["Mason", "Painter", "Labourer", "Tiler", "Carpenter", "Electrician", "Plumber", "Welder", "Other"];

export default function WorkerProfileForm({ initialWorker }) {
  const [form, setForm] = useState({ name: initialWorker.name === "Worker" ? "" : initialWorker.name, trade: initialWorker.trade, bio: initialWorker.bio, location: initialWorker.location === "Ghana" ? "" : initialWorker.location, phone: initialWorker.phone === "Not provided" ? "" : initialWorker.phone, yearsExperience: initialWorker.years_experience, hourlyRate: initialWorker.hourly_rate_kobo ? initialWorker.hourly_rate_kobo / 100 : "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(initialWorker.approval_status !== "approved");
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/worker/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setMessage(result.approvalStatus === "approved" ? "Profile updated. Your changes are now live in the worker directory." : "Profile submitted. An administrator will review it before it appears in the worker directory.");
      if (result.approvalStatus === "approved") setEditing(false);
    } catch (error) { setMessage(error.message || "Could not save your profile."); } finally { setBusy(false); }
  }
  if (!editing) return <div className="worker-profile-summary">
    <div className="worker-profile-summary-top"><div><span className="worker-profile-status">Approved and visible</span><h2>{form.name}</h2><p>{form.trade} · {form.location}</p></div><span className="worker-verified-badge" aria-label="Approved BuildMart professional">✓</span></div>
    <p className="worker-profile-summary-bio">{form.bio}</p>
    <div className="worker-profile-summary-details"><span><strong>{form.yearsExperience}</strong> years experience</span><span>{form.phone}</span></div>
    <button className="worker-primary-button" type="button" onClick={() => { setMessage(""); setEditing(true); }}>Edit profile</button>
    {message ? <p className="worker-form-message worker-form-success-message" role="status">{message}</p> : null}
  </div>;

  return <form className="worker-profile-form" onSubmit={submit}>
    <div className="worker-profile-grid"><label>Full name<input name="name" required maxLength={100} value={form.name} onChange={update} /></label><label>Trade<select name="trade" value={form.trade} onChange={update}>{trades.map((trade) => <option key={trade}>{trade}</option>)}</select></label><label>Location<input name="location" required maxLength={120} value={form.location} onChange={update} placeholder="e.g. Accra, Ghana" /></label><label>Phone<input name="phone" required maxLength={30} value={form.phone} onChange={update} /></label><label>Years of experience<input name="yearsExperience" type="number" min="0" max="80" value={form.yearsExperience} onChange={update} /></label><label className="worker-form-full">Professional bio<textarea name="bio" required minLength={20} maxLength={1000} rows={5} value={form.bio} onChange={update} placeholder="Tell customers what you do best." /></label></div>
    {message ? <p className="worker-form-message worker-form-success-message" role="status">{message}</p> : null}<div className="worker-profile-form-actions"><button className="worker-primary-button" type="submit" disabled={busy}>{busy ? "Saving profile…" : initialWorker.approval_status === "approved" ? "Save changes" : "Submit profile for approval"}</button>{initialWorker.approval_status === "approved" ? <button className="worker-secondary-button" type="button" onClick={() => { setMessage(""); setEditing(false); }}>Cancel</button> : null}</div>
  </form>;
}
