import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../services/auth.service";
import "./Signup.css";
import PasswordToggle from "./PasswordToggle";

export default function Signup() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSignup(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    setNotice("");

    const form = e.currentTarget as HTMLFormElement;

    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const username = (form.elements.namedItem("username") as HTMLInputElement)
      .value;

    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    if (!username.trim()) {
      setNotice("Enter a username.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await signup(email.trim(), username.trim(), password);

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
      <form id="signup-form" autoComplete="off" onSubmit={handleSignup}>
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
            autoComplete="off"
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
            autoComplete="off"
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
            autoComplete="off"
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

        <button type="submit" disabled={busy}>{busy ? "Signing up..." : "Sign up"}</button>

        <div className="signup-login">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
