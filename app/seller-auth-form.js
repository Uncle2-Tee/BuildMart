"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

async function activateSellerAccount(accessToken) {
  const response = await fetch("/api/seller/account", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "We couldn't prepare your seller account.");
}

export default function SellerAuthForm({ mode }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const supabase = createSupabaseBrowserClient();
      let session;

      if (isSignup) {
        const displayName = String(form.get("name") || "").trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              account_type: "seller",
              display_name: displayName,
            },
          },
        });
        if (error) throw error;

        session = data.session;
        if (!session) {
          setMessage("Check your email to confirm your account, then sign in to continue.");
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        session = data.session;
      }

      if (!session?.access_token) {
        throw new Error("Sign-in completed without an active session. Please sign in again.");
      }

      await activateSellerAccount(session.access_token);
      router.replace("/dashboard/seller");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't complete your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-card signup-card seller-auth-card">
      <Link className="account-back-link" href="/shop" aria-label="Back to shop">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 4 6.5 10l6 6" />
        </svg>
      </Link>
      <Link className="brand account-brand" href="/" aria-label="BuildMart home">
        <span className="mark brand-mark">B</span>
        <span>BuildMart<span className="brand-country">GH</span></span>
      </Link>
      <span className="eyebrow">SELLER ACCOUNT</span>
      <h1>{isSignup ? "Create your seller account" : "Welcome back"}</h1>
      <p className="account-intro">
        {isSignup
          ? "Sign up to register your shop and manage it after administrator approval."
          : "Sign in to register or manage your BuildMart shop."}
      </p>
      <form className="account-form seller-auth-form" onSubmit={submit}>
        {message ? <p className="form-error" role="alert">{message}</p> : null}
        {isSignup ? (
          <label>
            Your name
            <input name="name" autoComplete="name" minLength={2} maxLength={100} placeholder="e.g. Ama Mensah" required />
          </label>
        ) : null}
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" maxLength={254} placeholder="e.g. ama@example.com" required />
        </label>
        <label>
          Password
          <span className="password-input-wrap">
            <input
              name="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
              required
            />
            <button
              className="password-visibility-button"
              type="button"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {passwordVisible ? (
                  <>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.8 4.5 9.8 6.4a1.2 1.2 0 0 1 0 1.2 14 14 0 0 1-3.1 3.7" />
                    <path d="M6.2 6.2a14.8 14.8 0 0 0-4 5.2 1.2 1.2 0 0 0 0 1.2C3.2 14.5 6.8 19 12 19a10 10 0 0 0 3.2-.5" />
                  </>
                ) : (
                  <>
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </span>
          {isSignup ? <small className="seller-password-hint">Use at least 8 characters for your password.</small> : null}
        </label>
        <button className="button button-dark account-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Create seller account" : "Sign in"}
        </button>
      </form>
      <p className="account-switch-prompt">
        {isSignup ? "Already have a seller account? " : "New to selling on BuildMart? "}
        <Link href={isSignup ? "/seller/login" : "/seller/signup"}>
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
