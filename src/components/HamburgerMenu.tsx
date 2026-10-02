import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/auth.service";
import ThemeToggle from "./ThemeToggle";
import "./HamburgerMenu.css";

type HamburgerMenuProps = {
  dark: boolean;
  onThemeChange: (dark: boolean) => void;
  authenticated: boolean;
};

export default function HamburgerMenu({
  dark,
  onThemeChange,
  authenticated,
}: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.show();

    const closeWhenOutside = (event: Event) => {
      if (
        event.target instanceof Node &&
        !element.contains(event.target) &&
        !trigger.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("focusin", closeWhenOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("focusin", closeWhenOutside);
      document.removeEventListener("keydown", onKeyDown);
      element.close();
    };
  }, [open]);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await logout();
      if (error) throw error;
      setOpen(false);
      navigate("/");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to log out. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="hamburger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="settings-menu"
        aria-haspopup="dialog"
        onClick={() => {
          setError("");
          setOpen((current) => !current);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div
        className="hamburger-menu-backdrop"
        data-open={open}
        aria-hidden="true"
      />
      <dialog
        ref={dialog}
        id="settings-menu"
        className="hamburger-menu"
        aria-labelledby="settings-menu-title"
        inert={!open}
      >
        <div className="hamburger-menu-header">
          <h2 id="settings-menu-title">Menu</h2>
          <button
            type="button"
            className="hamburger-menu-close"
            aria-label="Close menu"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <div className="hamburger-menu-theme">
          <span>Appearance</span>
          <ThemeToggle dark={dark} onChange={onThemeChange} />
        </div>
        {authenticated && (
          <div className="hamburger-menu-footer">
            {error && <p role="alert">{error}</p>}
            <button
              type="button"
              className="logout-button"
              disabled={busy}
              onClick={handleLogout}
            >
              {busy ? "Logging out..." : "Log out"}
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
