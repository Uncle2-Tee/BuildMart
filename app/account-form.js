"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

function normalizePhoneNumber(value) {
  const digits = value.trim().replace(/\D/g, "");
  const normalized = value.trim().startsWith("+")
    ? `+${digits}`
    : digits.startsWith("00")
      ? `+${digits.slice(2)}`
      : digits.startsWith("233")
        ? `+${digits}`
        : digits.startsWith("0")
          ? `+233${digits.slice(1)}`
          : digits.length === 9
            ? `+233${digits}`
            : "";

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Enter a valid phone number, such as +233 24 123 4567.");
  }

  return normalized;
}

export default function AccountForm({ mode, initialRole = "", recoveryError = false, redirectTo = "", hideSignupLink = false }) {
  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  const isForgot = mode === "forgot";
  const needsConfirmation = isReset;
  const router = useRouter();
  const [pendingPhone, setPendingPhone] = useState("");
  const [phoneVerificationRequired, setPhoneVerificationRequired] = useState(false);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const accountRole = initialRole || "buyer";
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsStatus, setMessageIsStatus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [resetLinkInvalid, setResetLinkInvalid] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setMessageIsStatus(false);
    if (needsConfirmation && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

      if (isSignup) {
        const destination = accountRole === "seller" ? "/dashboard/seller" : "/dashboard/buyer/orders";
        const loginUrl = (check) => `/login?check=${check}&next=${encodeURIComponent(destination)}`;
        const isPhoneSignup = !identifier.includes("@");
        const displayName = isPhoneSignup
          ? accountRole === "seller" ? "Seller" : "Buyer"
          : identifier.split("@")[0].replace(/[._-]+/g, " ").trim();
        const userData = { display_name: displayName || "Buyer", account_role: accountRole };

        if (phoneVerificationRequired) {
          const { data, error } = await supabase.auth.verifyOtp({
            phone: pendingPhone,
            token: verificationCode.trim(),
            type: "sms",
          });

          if (error) throw error;
          if (!data.session) throw new Error("We couldn't verify that code. Request a new one and try again.");
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
          router.replace(loginUrl("phone"));
          return;
        }

        if (isPhoneSignup) {
          const normalizedPhone = normalizePhoneNumber(identifier);
          const { data, error } = await supabase.auth.signUp({
            phone: normalizedPhone,
            password,
            options: { data: { ...userData, phone_number: normalizedPhone } },
          });

          if (error) throw error;
          if (data.session) {
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) throw signOutError;
            router.replace(loginUrl("created"));
            return;
          }

          setPendingPhone(normalizedPhone);
          setPhoneVerificationRequired(true);
          setMessage("We sent a verification code to your phone. Enter it below to finish creating your account.");
          setMessageIsStatus(true);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: identifier.trim().toLowerCase(),
          password,
          options: {
            data: { ...userData, phone_number: "" },
            emailRedirectTo: new URL(loginUrl("email"), siteUrl).toString(),
          },
        });

        if (error) throw error;
        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
          router.replace(loginUrl("created"));
          return;
        }
        setEmailVerificationRequired(true);
        setMessage(`A verification email has been sent to ${identifier.trim()}. Check your inbox and spam folder.`);
        setMessageIsStatus(true);
        return;
      } else if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: new URL("/login?mode=reset", siteUrl).toString(),
        });
        if (error) throw error;
        setMessage("If an account exists for that email, a password reset link is on its way. Check your inbox.");
        setMessageIsStatus(true);
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
        const loginValue = identifier.trim();
        const credentials = loginValue.includes("@")
          ? { email: loginValue.toLowerCase(), password }
          : { phone: normalizePhoneNumber(loginValue), password };
        const { error } = await supabase.auth.signInWithPassword(credentials);
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
              ? redirectTo === "/dashboard/buyer/shop" ? redirectTo : "/dashboard/buyer/orders"
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
      setMessageIsStatus(false);
    } finally {
      setBusy(false);
    }
  }

  async function resendVerificationCode() {
    setMessage("");
    setMessageIsStatus(false);
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const resendRequest = emailVerificationRequired
        ? supabase.auth.resend({
            type: "signup",
            email: identifier.trim().toLowerCase(),
            options: {
              emailRedirectTo: new URL(
                `/login?check=email&next=${encodeURIComponent(accountRole === "seller" ? "/dashboard/seller" : "/dashboard/buyer/orders")}`,
                process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
              ).toString(),
            },
          })
        : supabase.auth.resend({ type: "sms", phone: pendingPhone });
      const { error } = await resendRequest;
      if (error) throw error;
      setMessage(emailVerificationRequired ? "Another verification email has been sent." : "A new verification code has been sent.");
      setMessageIsStatus(true);
    } catch (error) {
      setMessage(error.message || "We couldn't send another code. Please try again.");
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
        {message ? (
          <p className={messageIsStatus ? "success-message" : "form-error"} role={messageIsStatus ? "status" : "alert"}>{message}</p>
        ) : null}
        {isForgot ? (
          <label>
            Email address
            <input type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        ) : null}
        {!isReset && !isForgot && !phoneVerificationRequired && !emailVerificationRequired ? (
          <label>
            Email or phone number
            <input
              type="text"
              autoComplete="username"
              required
              placeholder="Email or phone number"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>
        ) : null}
        {!isReset && !isForgot && !phoneVerificationRequired && !emailVerificationRequired ? (
          <div className="account-field">
            <label htmlFor="account-password">Password</label>
            <span className="password-input-wrap">
              <input id="account-password" type={showPassword ? "text" : "password"} autoComplete={isSignup || isReset ? "new-password" : "current-password"} required minLength={isSignup || isReset ? 8 : undefined} placeholder={isSignup ? "Create a password" : "Enter your password"} value={password} onChange={(event) => setPassword(event.target.value)} />
              <button className="password-visibility-button" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword ? <path d="m4 4 16 16" /> : null}
                </svg>
              </button>
            </span>
            {isSignup || isReset ? <small>Use at least 8 characters.</small> : null}
          </div>
        ) : null}
        {needsConfirmation && !phoneVerificationRequired ? (
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
        {phoneVerificationRequired ? (
          <>
            <label>
              Verification code
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} required pattern="[0-9]*" placeholder="Enter the code from your SMS" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))} />
            </label>
            <button className="account-resend-code" disabled={busy} onClick={resendVerificationCode} type="button">Resend code</button>
          </>
        ) : null}
        {emailVerificationRequired ? (
          <button className="account-resend-code" disabled={busy} onClick={resendVerificationCode} type="button">
            Resend confirmation email
          </button>
        ) : null}
        {mode === "login" ? (
          <div className="forgot-password-row">
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
        ) : null}
        {message && !isForgot && !isReset ? <p className={message.startsWith("Account created") ? "success-message" : "form-error"} role={message.startsWith("Account created") ? "status" : "alert"}>{message}</p> : null}
        {!emailVerificationRequired ? (
          <button className="button button-dark account-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : phoneVerificationRequired ? "Verify phone number" : isSignup ? "Create account" : isReset ? "Save new password" : isForgot ? "Send reset link" : "Log in"}
          </button>
        ) : null}
      </form>
      )}
      {isReset ? (
        <p className="account-switch-prompt"><Link href="/login">Return to log in</Link></p>
      ) : isForgot ? (
        <p className="account-switch-prompt"><Link href="/login">Return to log in</Link></p>
      ) : isSignup && phoneVerificationRequired ? null : isSignup || !hideSignupLink ? (
        <p className="account-switch-prompt">
          {isSignup ? "Already have an account?" : "New to BuildMart?"}
          {" "}
          <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Sign up"}</Link>
        </p>
      ) : null}
    </>
  );
}
