"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export default function AccountForm({ initialMode = "login", initialRole = "buyer" }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [accountRole, setAccountRole] = useState(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name, account_role: accountRole },
            emailRedirectTo: `${window.location.origin}/account`,
          },
        });

        if (error) throw error;
        if (!data.session) {
          setMessage("Account created. Check your email to confirm your address, then sign in.");
          return;
        }
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
      setMessage(error.message || "We couldn't complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="account-tabs" role="tablist" aria-label="Account action">
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>Create an account</button>
      </div>
      <form className="account-form" onSubmit={submit}>
        {mode === "signup" ? (
          <>
            <label>
              Your name
              <input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Account type
              <select value={accountRole} onChange={(event) => setAccountRole(event.target.value)}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
              {accountRole === "seller" ? <small>Your shop will be reviewed by an administrator before it goes live.</small> : null}
            </label>
          </>
        ) : null}
        <label>
          Email address
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          {mode === "signup" ? <small>Use at least 8 characters.</small> : null}
        </label>
        {message ? <p className={message.startsWith("Account created") ? "success-message" : "form-error"} role="alert">{message}</p> : null}
        <button className="button button-dark account-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in securely"}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
      <p className="account-security"><span aria-hidden="true">◈</span> Your account is protected by Supabase authentication.</p>
    </>
  );
}
