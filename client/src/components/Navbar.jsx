import { useState, useEffect } from "react";
import "./Navbar.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

export default function Navbar({ spotifyToken, onLogout }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
      <a href="/" className="navbar__logo" aria-label="Duo-fy home">
        <img src="/duo-fy-icon.png" alt="" className="navbar__logo-img" aria-hidden="true" />
        <span className="navbar__logo-text">Duo-fy</span>
      </a>

      <nav className="navbar__actions">
        {spotifyToken ? (
          <button onClick={onLogout} className="navbar__btn-connected" aria-label="Disconnect Spotify">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span className="navbar__connected-text">Connected</span>
            <span className="navbar__connected-dot" />
          </button>
        ) : (
          <button onClick={() => { window.location.href = `${BACKEND_URL}/login`; }} className="btn-primary navbar__btn-signup">
            Login with Spotify
          </button>
        )}
      </nav>
    </header>
  );
}