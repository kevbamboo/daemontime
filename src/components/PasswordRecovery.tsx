import { useState, type SubmitEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import PasswordToggle from "./PasswordToggle";
import "./Login.css";

export default function PasswordRecovery({ mode, authenticated }: {
  mode: "request" | "update";
  authenticated: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [complete, setComplete] = useState(false);
  const [visible, setVisible] = useState(false);
  const updating = mode === "update";
  const canSubmit = !updating || authenticated;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !canSubmit || complete) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    setBusy(true);
    setNotice("");
    try {
      const { error } = updating
        ? await supabase.auth.updateUser({ password: String(data.get("password")) })
        : await supabase.auth.resetPasswordForEmail(String(data.get("email")).trim(), {
            redirectTo: new URL("/reset-password/", window.location.origin).href,
          });
      if (error) throw error;
      setComplete(true);
      setNotice(updating
        ? "Your password has been updated."
        : "If an account exists for that email, a password reset link will arrive shortly.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to reset your password. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="auth-heading">
            <h1>{updating ? "Choose a password" : "Reset your password"}</h1>
            <p>{updating ? "Enter your new password below." : "We'll email you a reset link."}</p>
          </div>
        </div>
        {!canSubmit && <p role="alert">Open the reset link from your email. If it has expired, <Link to="/forgot-password">request a new link</Link>.</p>}
        {notice && <p role={complete ? "status" : "alert"}>{notice}</p>}
        {canSubmit && !complete && (
          <form id="login-form" onSubmit={submit}>
            <div className={`input-container${updating ? " password-container" : ""}`}>
              <input
                id="recovery-value"
                name={updating ? "password" : "email"}
                type={updating ? (visible ? "text" : "password") : "email"}
                autoComplete={updating ? "new-password" : "email"}
                minLength={updating ? 6 : undefined}
                placeholder=" "
                required
                disabled={busy}
              />
              <label htmlFor="recovery-value">{updating ? "New password" : "Email"}</label>
              {updating && <PasswordToggle visible={visible} onToggle={() => setVisible(!visible)} />}
            </div>
            <button type="submit" disabled={busy}>
              {busy ? "Please wait..." : updating ? "Update password" : "Send reset link"}
            </button>
          </form>
        )}
        <div className="signup-prompt">
          <Link to={complete && updating ? "/" : "/login"}>{complete && updating ? "Continue" : "Back to log in"}</Link>
        </div>
      </div>
    </main>
  );
}
