import { useState } from "react";
import "./AuthModal.css";
import GuestLoginButton from "./GuestLoginButton";
import { useNavigate } from "react-router-dom";

export default function AuthModal() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-mark">DT</div>

        <h2>Ready to practice?</h2>

        <p>Choose how you'd like to continue.</p>

        <div className="auth-options">
          <GuestLoginButton onBusyChange={setBusy} />

          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => navigate("/login")}
          >
            Log in
          </button>

          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => navigate("/signup")}
          >
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
}
