"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const trades = ["Mason", "Painter", "Labourer", "Tiler", "Carpenter", "Electrician", "Plumber", "Welder", "Other"];

export default function WorkerAuthForm({ mode }) {
  const isSignup = mode === "signup";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    try {
      let session;
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: String(form.get("email")).trim(),
          password: String(form.get("password")),
          options: {
            data: {
              account_type: "worker",
              display_name: String(form.get("name")).trim(),
              trade: String(form.get("trade") || "Other"),
            },
          },
        });
        if (error) throw error;
        session = data.session;
        if (!session) {
          setMessage("Check your email to confirm your account, then log in to complete your profile.");
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: String(form.get("email")).trim(),
          password: String(form.get("password")),
        });
        if (error) throw error;
        session = data.session;
      }
      const response = await fetch("/api/worker/account", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn't prepare your worker account.");
      window.location.replace("/dashboard/worker");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't complete your request.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="account-page worker-auth-page"><section className="account-card signup-card seller-auth-card">
    <Link className="account-back-link" href="/workers" aria-label="Back to workers">←</Link>
    <Link className="brand account-brand" href="/" aria-label="BuildMart home"><span className="brand-logo-card"><Image className="brand-logo" src="/buildmart-logo.png" alt="BuildMart Ghana" width={928} height={192} priority /></span></Link>
    <span className="eyebrow">WORKER NETWORK</span>
    <h1>{isSignup ? "Join the worker network" : "Worker log in"}</h1>
    {!isSignup ? <p className="account-intro">Log in to manage your worker profile and booking requests.</p> : null}
    <form className="account-form seller-auth-form" onSubmit={submit}>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      {isSignup ? <label>Your name<input name="name" autoComplete="name" minLength={2} maxLength={100} placeholder="e.g. Kwame Mensah" required /></label> : null}
      {isSignup ? <label>Trade<select name="trade" defaultValue="" required><option value="" disabled>Select your trade</option>{trades.map((trade) => <option key={trade} value={trade}>{trade}</option>)}</select></label> : null}
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} placeholder="e.g. kwame@example.com" required /></label>
      <label>Password<span className="password-input-wrap"><input name="password" type={passwordVisible ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} maxLength={128} placeholder={isSignup ? "At least 8 characters" : "Enter your password"} required /><button className="password-visibility-button" type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{passwordVisible ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.8 4.5 9.8 6.4a1.2 1.2 0 0 1 0 1.2 14 14 0 0 1-3.1 3.7" /><path d="M6.2 6.2a14.8 14.8 0 0 0-4 5.2 1.2 1.2 0 0 0 0 1.2C3.2 14.5 6.8 19 12 19a10 10 0 0 0 3.2-.5" /></> : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}</svg></button></span></label>
      <button className="button button-dark account-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : isSignup ? "Create worker account" : "Log in"}</button>
    </form>
    <p className="account-switch-prompt">{isSignup ? "Already registered? " : "New worker? "}<Link href={isSignup ? "/worker/login" : "/worker/signup"}>{isSignup ? "Log in" : "Create an account"}</Link></p>
  </section></main>;
}
