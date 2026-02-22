import { useEffect, useState, useCallback, useRef } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

export function loginWithSpotify() {
  window.location.href = `${BACKEND_URL}/login`;
}

export function fmtMs(ms) {
  if (!ms || isNaN(ms)) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function useSpotify(accessToken, onTokenExpired) {
  const [track,      setTrack]      = useState(null);
  const [progressMs, setProgressMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [profile,    setProfile]    = useState(null);

  const interpolatorRef = useRef(null);
  const lastPollRef     = useRef({ progressMs: 0, ts: 0, playing: false });

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  useEffect(() => {
    if (!accessToken) { setProfile(null); return; }
    fetch("https://api.spotify.com/v1/me", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setProfile({ name: data.display_name || "Listener", avatarUrl: data.images?.[0]?.url ?? null });
      })
      .catch(() => {});
  }, [accessToken, authHeaders]);

  useEffect(() => {
    if (!accessToken) {
      setTrack(null); setProgressMs(0); setDurationMs(0); setIsPlaying(false);
      clearInterval(interpolatorRef.current);
      return;
    }

    const handle401 = () => { console.warn("[useSpotify] 401"); onTokenExpired?.(); };

    const fetchTrack = async () => {
      try {
        const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers: authHeaders() });
        if (res.status === 401) { handle401(); return; }
        if (res.status === 204) { setTrack(null); setIsPlaying(false); lastPollRef.current = { progressMs: 0, ts: Date.now(), playing: false }; return; }
        if (!res.ok) return;
        const data = await res.json();
        const prog = data.progress_ms ?? 0;
        const dur  = data.item?.duration_ms ?? 0;
        const play = data.is_playing ?? false;
        setTrack(data.item ?? null); setDurationMs(dur); setIsPlaying(play); setProgressMs(prog);
        lastPollRef.current = { progressMs: prog, ts: Date.now(), playing: play };
      } catch (err) { console.error("[useSpotify] error:", err); }
    };

    fetchTrack();
    const pollInterval = setInterval(fetchTrack, 5000);

    interpolatorRef.current = setInterval(() => {
      const { progressMs: base, ts, playing } = lastPollRef.current;
      if (!playing) return;
      setProgressMs(prev => { const inferred = base + (Date.now() - ts); return inferred > prev ? inferred : prev; });
    }, 500);

    return () => { clearInterval(pollInterval); clearInterval(interpolatorRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return { track, progressMs, durationMs, isPlaying, profile };
}
