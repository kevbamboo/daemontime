import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../services/auth.service";
import "./AuthForm.css";
import PasswordToggle from "./PasswordToggle";
import GuestLoginButton from "./GuestLoginButton";

export default function Signup() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);

  async function handleSignup(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || guestBusy) return;
    setNotice("");

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim();
    const username = String(data.get("username")).trim();
    const password = String(data.get("password"));

    if (!username) {
      setNotice("Enter a username.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await signup(email, username, password);

      if (error) {
        setNotice(error.message);
        return;
      }

      if (data.session) navigate("/");
      else
        setNotice(
          "Check your email to confirm your account before logging in.",
        );
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to sign up. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="signup-page">
      <form id="signup-form" onSubmit={handleSignup}>
        <div className="signup-header">
          <div className="auth-heading">
            <h1>Create your account</h1>
            <p>Start practicing and improve your SAT score.</p>
          </div>
          <div className="logo-mark">DT</div>
        </div>

        {notice && <p role="status">{notice}</p>}
        <div className="input-container">
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            placeholder=" "
            required
          />
          <label htmlFor="email">Email</label>
        </div>

        <div className="input-container">
          <input
            type="text"
            id="username"
            name="username"
            autoComplete="username"
            placeholder=" "
            required
          />
          <label htmlFor="username">Username</label>
        </div>

        <div className="input-container password-container">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={6}
            placeholder=" "
            required
          />
          <label htmlFor="password">Password</label>

          <PasswordToggle
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
        </div>

        <button type="submit" disabled={busy || guestBusy}>
          {busy ? "Signing up..." : "Sign up"}
        </button>

        <div className="signup-login">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
        <GuestLoginButton
          variant="link"
          disabled={busy}
          onBusyChange={setGuestBusy}
        />
      </form>
    </div>
  );
}
