import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";
import Home from "./components/Home";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ThemeToggle from "./components/ThemeToggle";
import { supabase } from "./lib/supabase";
import { socketService } from "./services/socket.service";

const PasswordRecovery = lazy(() => import("./components/PasswordRecovery"));

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [dark, setDark] = useState(true);
  const [changingTheme, setChangingTheme] = useState(false);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) socketService.connect(session.access_token, session.user.id);
      else socketService.disconnect();
      setAuthenticated(!!session);
      setInitializing(false);
    });
    return () => {
      subscription.unsubscribe();
      socketService.disconnect();
    };
  }, []);
  function changeTheme(nextDark: boolean) {
    setChangingTheme(true);
    setDark(nextDark);
    window.setTimeout(() => setChangingTheme(false), 150);
  }
  useEffect(() => {
    document.documentElement.classList.toggle("dark-theme", dark);
    document.documentElement.classList.toggle("light-theme", !dark);
    document.body.classList.toggle("dark-theme", dark);
    document.body.classList.toggle("light-theme", !dark);
  }, [dark]);
  if (initializing) return <div>Loading...</div>;
  return (
    <BrowserRouter>
      <div className={`${dark ? "dark-theme" : "light-theme"} app-shell${changingTheme ? " theme-changing" : ""}`}>
        <ThemeToggle dark={dark} onChange={changeTheme} />
        <Suspense fallback={<p role="status">Loading page...</p>}>
        <Routes>
          <Route path="/" element={<Home authenticated={authenticated} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<PasswordRecovery key="request" mode="request" authenticated={authenticated} />} />
          <Route path="/reset-password" element={<PasswordRecovery key="update" mode="update" authenticated={authenticated} />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Return home</Link></p>} />
        </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
