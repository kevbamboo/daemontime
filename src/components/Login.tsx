import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/auth.service";
import "./Login.css";
import PasswordToggle from "./PasswordToggle";

export default function Login() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");

    const form = e.currentTarget as HTMLFormElement;

    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      const { error } = await login(email.trim(), password);

      if (error) {
        setNotice(error.message);
        return;
      }

      navigate("/");
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to log in. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="auth-heading">
            <h1>Welcome back</h1>
            <p>Keep working toward your SAT goals.</p>
          </div>
          <div className="logo-mark">DT</div>
        </div>

        {notice && <p role="alert">{notice}</p>}
        <form id="login-form" autoComplete="off" onSubmit={handleLogin}>
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

          <div className="input-container password-container">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              autoComplete="off"
              placeholder=" "
              required
            />
            <label htmlFor="password">Password</label>

            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
            />
          </div>

          <div className="forgot-password">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button type="submit" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
        </form>

        <div className="signup-prompt">
          Don't have an account? <Link to="/signup">Create one</Link>
        </div>
      </div>
    </main>
  );
}
