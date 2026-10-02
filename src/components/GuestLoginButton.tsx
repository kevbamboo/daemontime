import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { guestLogin } from "../services/auth.service";
import "./GuestLoginButton.css";

type GuestLoginButtonProps = {
  variant?: "button" | "link";
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

export default function GuestLoginButton({
  variant = "button",
  disabled = false,
  onBusyChange,
}: GuestLoginButtonProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleGuestLogin() {
    if (busy || disabled) return;
    setError("");
    setBusy(true);
    onBusyChange?.(true);
    try {
      const result = await guestLogin();
      if (result.error) {
        setError(result.error.message);
        return;
      }
      navigate("/");
    } catch {
      setError("Unable to sign in. Please retry.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="guest-login">
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className={variant === "link" ? "guest-login-link" : "guest-button"}
        onClick={handleGuestLogin}
        disabled={busy || disabled}
      >
        {busy ? "Signing in..." : "Continue as Guest"}
      </button>
    </div>
  );
}
