"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "We couldn't sign you in. Please try again.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setMessage("We couldn't reach the sign-in service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-form admin-login-form" onSubmit={signIn}>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <label>
        Administrator username
        <input name="username" autoComplete="username" placeholder="e.g. admin" required />
      </label>
      <label>
        Password
        <span className="password-input-wrap">
          <input
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your admin password"
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
      </label>
      <button className="button button-dark account-submit" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in to admin"}
      </button>
    </form>
  );
}
