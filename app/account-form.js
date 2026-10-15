"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export default function AccountForm({ mode, initialRole = "", recoveryError = false }) {
  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  const isForgot = mode === "forgot";
  const needsConfirmation = isSignup || isReset;
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountRole, setAccountRole] = useState(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [resetLinkInvalid, setResetLinkInvalid] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    if (needsConfirmation && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name, phone_number: phone, account_role: accountRole },
            emailRedirectTo: new URL("/login", siteUrl).toString(),
          },
        });

        if (error) throw error;
        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
        }
        router.replace("/login?check=1");
        return;
      } else if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: new URL("/login?mode=reset", siteUrl).toString(),
        });
        if (error) throw error;
        setMessage("If an account exists for that email, a password reset link is on its way. Check your inbox.");
        return;
      } else if (isReset) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setResetComplete(true);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Password updated, but recovery session sign-out failed", signOutError);
          setMessage("Your password was updated, but we couldn't end the recovery session. Please sign out, then log in with your new password.");
        } else {
          setMessage("Your password has been updated. Log in with your new password.");
        }
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, seller_status")
        .eq("id", userData.user.id)
        .single();

      if (profileError) throw profileError;
      const destination = profile.role === "admin"
        ? "/admin"
        : profile.role === "seller"
          ? "/dashboard/seller"
          : profile.role === "buyer"
            ? "/dashboard/buyer"
            : "/account";
      if (destination === "/account") throw new Error("This account does not have a supported role.");
      router.replace(destination);
      router.refresh();
    } catch (error) {
      if (
        isReset &&
        (error.name === "AuthSessionMissingError" ||
          error.code === "otp_expired" ||
          error.code === "session_not_found")
      ) {
        setResetLinkInvalid(true);
        setMessage("This password reset link is invalid or has expired.");
        return;
      }
      setMessage(error.message || "We couldn't complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {recoveryError || resetLinkInvalid ? (
        <div className="password-recovery-notice" role="alert">
          <p>This password reset link is invalid or has expired.</p>
          <Link href="/forgot-password">Request a new reset link</Link>
        </div>
      ) : resetComplete ? (
        <div className="password-recovery-notice" role="status">
          <p>{message}</p>
          <Link href="/login">Go to log in</Link>
        </div>
      ) : (
      <form className="account-form" onSubmit={submit}>
        {message && (isForgot || isReset) ? (
          <p className={message.startsWith("If an account exists") || message.startsWith("Your password") ? "success-message" : "form-error"} role={message.startsWith("If an account exists") || message.startsWith("Your password") ? "status" : "alert"}>{message}</p>
        ) : null}
        {isSignup ? (
          <>
            <label>
              Full name
              <input autoComplete="name" required minLength={2} maxLength={80} placeholder="e.g. Elliot Fiawornu" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          </>
        ) : null}
        {!isReset ? (
          <label>
            Email address
            <input type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        ) : null}
        {isSignup ? (
          <>
            <label>
              Phone number <span className="optional-label">Optional</span>
              <input type="tel" autoComplete="tel" maxLength={24} placeholder="e.g. 024 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label>
              Select your role
              <select required value={accountRole} onChange={(event) => setAccountRole(event.target.value)}>
                <option value="" disabled>Select how you want to use BuildMart</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
              {accountRole === "seller" ? <small>Your shop will be reviewed by an administrator before it goes live.</small> : null}
            </label>
          </>
        ) : null}
        {!isReset && !isForgot ? (
          <div className="account-field">
            <label htmlFor="account-password">Password</label>
            <span className="password-input-wrap">
              <input id="account-password" type={showPassword ? "text" : "password"} autoComplete={needsConfirmation ? "new-password" : "current-password"} required minLength={needsConfirmation ? 8 : undefined} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button className="password-visibility-button" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword ? <path d="m4 4 16 16" /> : null}
                </svg>
              </button>
            </span>
            {needsConfirmation ? <small>Use at least 8 characters.</small> : null}
          </div>
        ) : null}
        {needsConfirmation ? (
          <div className="account-field">
            <label htmlFor="account-confirm-password">{isReset ? "Confirm new password" : "Confirm password"}</label>
            <span className="password-input-wrap">
              <input id="account-confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} placeholder="Enter your password again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              <button className="password-visibility-button" type="button" aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((visible) => !visible)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showConfirmPassword ? <path d="m4 4 16 16" /> : null}
                </svg>
              </button>
            </span>
          </div>
        ) : null}
        {mode === "login" ? (
          <div className="forgot-password-row">
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
        ) : null}
        {message && !isForgot && !isReset ? <p className={message.startsWith("Account created") ? "success-message" : "form-error"} role={message.startsWith("Account created") ? "status" : "alert"}>{message}</p> : null}
        <button className="button button-dark account-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Create account" : isReset ? "Save new password" : isForgot ? "Send reset link" : "Log in"}
        </button>
      </form>
      )}
      {isReset ? (
        <p className="account-switch-prompt"><Link href="/login">Return to log in</Link></p>
      ) : isForgot ? (
        <p className="account-switch-prompt"><Link href="/login">Return to log in</Link></p>
      ) : (
        <p className="account-switch-prompt">
          {isSignup ? "Already have an account?" : "New to BuildMart?"}
          {" "}
          <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Sign up"}</Link>
        </p>
      )}
    </>
  );
}
