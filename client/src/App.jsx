import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Room from "./components/Room";
import JoinRoomModal from "./components/JoinRoomModal";
import socketService from "./socket";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => chars[b % chars.length]
  ).join("");
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function saveTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem("spotify_access_token", access_token);
  if (refresh_token) {
    localStorage.setItem("spotify_refresh_token", refresh_token);
  }
  // Store expiry as an absolute timestamp (shave 60s off for safety margin)
  const expiresAt = Date.now() + (Number(expires_in) - 60) * 1000;
  localStorage.setItem("spotify_expires_at", String(expiresAt));
}

function loadTokens() {
  return {
    accessToken:  localStorage.getItem("spotify_access_token"),
    refreshToken: localStorage.getItem("spotify_refresh_token"),
    expiresAt:    Number(localStorage.getItem("spotify_expires_at") || 0),
  };
}

function clearTokens() {
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_expires_at");
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(
    `${BACKEND_URL}/refresh?refresh_token=${encodeURIComponent(refreshToken)}`
  );
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json(); // { access_token, expires_in }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [roomId, setRoomId]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [spotifyToken, setSpotifyToken]   = useState(null);

  const roomIdRef        = useRef(null);
  const refreshTimerRef  = useRef(null);

  // ── Schedule a proactive token refresh ──────────────────────────────────────
  const scheduleRefresh = useCallback((expiresAt, refreshToken) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const delay = expiresAt - Date.now(); // ms until expiry (already has 60s buffer)
    if (delay <= 0 || !refreshToken) return;

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await refreshAccessToken(refreshToken);
        const { access_token, expires_in } = data;

        saveTokens({ access_token, refresh_token: refreshToken, expires_in });
        setSpotifyToken(access_token);
        scheduleRefresh(Number(localStorage.getItem("spotify_expires_at")), refreshToken);
        console.log("[Duo-fy] Token refreshed silently.");
      } catch (err) {
        console.error("[Duo-fy] Silent refresh failed:", err);
        clearTokens();
        setSpotifyToken(null);
      }
    }, delay);
  }, []);

  // ── On mount: parse URL params OR restore from localStorage ─────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken  = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn    = params.get("expires_in");
    const authError    = params.get("auth_error");

    // Always clean the URL regardless
    if (params.toString()) {
      window.history.replaceState({}, document.title, "/");
    }

    if (authError) {
      setError(`Spotify login failed: ${authError.replace(/_/g, " ")}`);
      return;
    }

    if (accessToken) {
      // Fresh login callback
      saveTokens({ access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn });
      setSpotifyToken(accessToken);
      scheduleRefresh(Number(localStorage.getItem("spotify_expires_at")), refreshToken);
      return;
    }

    // Restore existing session
    const { accessToken: stored, refreshToken: storedRefresh, expiresAt } = loadTokens();
    if (stored) {
      if (expiresAt && Date.now() >= expiresAt) {
        // Token already expired — try to refresh immediately
        if (storedRefresh) {
          refreshAccessToken(storedRefresh)
            .then(({ access_token, expires_in }) => {
              saveTokens({ access_token, refresh_token: storedRefresh, expires_in });
              setSpotifyToken(access_token);
              scheduleRefresh(Number(localStorage.getItem("spotify_expires_at")), storedRefresh);
            })
            .catch(() => {
              clearTokens();
            });
        } else {
          clearTokens();
        }
      } else {
        setSpotifyToken(stored);
        scheduleRefresh(expiresAt, storedRefresh);
      }
    }

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Room ref sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (roomIdRef.current) socketService.leaveRoom(roomIdRef.current);
      socketService.disconnect();
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConnectionFailure = useCallback((msg) => {
    setError(msg);
    setRoomId(null);
    socketService.disconnect();
  }, []);

  const handleCreateRoom = useCallback(async () => {
    if (loading) return;
    const newId = generateRoomId();
    setLoading(true);
    setError(null);
    try {
      if (!socketService.connected) socketService.connect();
      await socketService.createRoom(newId);
      setRoomId(newId);
    } catch (err) {
      handleConnectionFailure(err?.message || "Failed to create room.");
    } finally {
      setLoading(false);
    }
  }, [loading, handleConnectionFailure]);

  const handleJoinRoom = useCallback(async (id) => {
    const trimmed = id?.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (!socketService.connected) socketService.connect();
      await socketService.joinRoom(trimmed);
      setRoomId(trimmed);
      setShowJoinModal(false);
    } catch (err) {
      handleConnectionFailure(err?.message || "Failed to join room.");
    } finally {
      setLoading(false);
    }
  }, [loading, handleConnectionFailure]);

  const handleLeaveRoom = useCallback(() => {
    if (roomIdRef.current) socketService.leaveRoom(roomIdRef.current);
    socketService.disconnect();
    setRoomId(null);
    setError(null);
  }, []);

  const handleLogout = useCallback(() => {
    clearTokens();
    setSpotifyToken(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <Navbar spotifyToken={spotifyToken} onLogout={handleLogout} />

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      {!roomId ? (
        <Hero
          onCreateRoom={handleCreateRoom}
          onJoinRoom={() => setShowJoinModal(true)}
          loading={loading}
          spotifyToken={spotifyToken}
        />
      ) : (
        <Room
          key={roomId}
          roomId={roomId}
          onLeaveRoom={handleLeaveRoom}
          spotifyToken={spotifyToken}
        />
      )}

      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinRoom}
        loading={loading}
      />
    </div>
  );
}