/**
 * src/components/SearchPanel.jsx
 *
 * Full-screen search with instant feel:
 * - Auto-focus + mobile keyboard opens immediately
 * - Shimmer skeleton loading cards
 * - Debounced search (300ms) with visual feedback on every keystroke
 * - Clean result cards with album art, queue + play actions
 * - Proper empty / no-results / error states
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { spotifySearch, spotifyPlay, spotifyAddToQueue } from "../hooks/useSpotifyPlayer";
import "./SearchPanel.css";

const fmt = ms => {
  if (!ms) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Shimmer skeleton card
function SkeletonCard() {
  return (
    <div className="sp-skeleton">
      <div className="sp-skeleton__art" />
      <div className="sp-skeleton__body">
        <div className="sp-skeleton__line sp-skeleton__line--title" />
        <div className="sp-skeleton__line sp-skeleton__line--sub" />
      </div>
    </div>
  );
}

export default function SearchPanel({ accessToken, deviceId, onClose, onTrackPlay }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [status,  setStatus]  = useState("idle"); // idle | loading | done | error
  const [queued,  setQueued]  = useState({});      // trackId → true (flash ✓)

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  // Auto-focus — also triggers mobile keyboard
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Search — instant visual feedback on every keystroke, debounced API call
  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setStatus("idle");
      return;
    }

    // Show loading immediately so it feels responsive
    setStatus("loading");

    debounceRef.current = setTimeout(async () => {
      try {
        const tracks = await spotifySearch(accessToken, query, 15);
        setResults(tracks);
        setStatus("done");
      } catch {
        setResults([]);
        setStatus("error");
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, accessToken]);

  const handlePlay = useCallback(async track => {
    try {
      await spotifyPlay(accessToken, deviceId, { uris: [track.uri] });
      onTrackPlay?.(track);
      onClose();
    } catch (e) {
      console.error("Play error:", e);
    }
  }, [accessToken, deviceId, onClose, onTrackPlay]);

  const handleQueue = useCallback(async track => {
    try {
      await spotifyAddToQueue(accessToken, track.uri);
      setQueued(p => ({ ...p, [track.id]: true }));
      setTimeout(() => setQueued(p => {
        const n = { ...p }; delete n[track.id]; return n;
      }), 2000);
    } catch (e) {
      console.error("Queue error:", e);
    }
  }, [accessToken]);

  const hasResults  = results.length > 0;
  const isLoading   = status === "loading";
  const isEmpty     = status === "done" && !hasResults;
  const isError     = status === "error";

  return (
    <div className="sp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sp-sheet" role="dialog" aria-label="Search songs">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="sp-header">
          <div className={`sp-input-wrap ${isLoading ? "sp-input-wrap--loading" : ""} ${query ? "sp-input-wrap--active" : ""}`}>
            <span className="sp-input-icon" aria-hidden>
              {isLoading
                ? <div className="sp-spin" />
                : <SearchIcon />
              }
            </span>
            <input
              ref={inputRef}
              className="sp-input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Search songs, artists, albums…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {query && (
              <button
                className="sp-clear"
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                aria-label="Clear search"
              >
                <ClearIcon />
              </button>
            )}
          </div>
          <button className="sp-cancel" onClick={onClose}>Cancel</button>
        </div>

        {/* ── Results body ────────────────────────────────── */}
        <div className="sp-body">

          {/* Idle state */}
          {status === "idle" && (
            <div className="sp-state">
              <div className="sp-state__emoji">🎵</div>
              <p className="sp-state__title">Search for a song</p>
              <p className="sp-state__sub">Type anything — song, artist, or album</p>
            </div>
          )}

          {/* Loading skeletons — 6 shimmer cards */}
          {isLoading && (
            <div className="sp-list">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* No results */}
          {isEmpty && (
            <div className="sp-state">
              <div className="sp-state__emoji">🔍</div>
              <p className="sp-state__title">No results for "{query}"</p>
              <p className="sp-state__sub">Try different words or check spelling</p>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="sp-state">
              <div className="sp-state__emoji">⚠️</div>
              <p className="sp-state__title">Search failed</p>
              <p className="sp-state__sub">Check your connection and try again</p>
            </div>
          )}

          {/* Results */}
          {status === "done" && hasResults && (
            <div className="sp-list">
              {results.map((track, idx) => (
                <div
                  key={track.id}
                  className="sp-track"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  {/* Album art */}
                  <div className="sp-track__art-wrap">
                    <img
                      src={track.album?.images?.[2]?.url ?? track.album?.images?.[0]?.url ?? ""}
                      alt=""
                      className="sp-track__art"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="sp-track__info">
                    <p className="sp-track__name">{track.name}</p>
                    <p className="sp-track__meta">
                      {track.artists.map(a => a.name).join(", ")}
                      {track.album?.name && (
                        <span className="sp-track__album"> · {track.album.name}</span>
                      )}
                    </p>
                  </div>

                  {/* Duration */}
                  <span className="sp-track__dur">{fmt(track.duration_ms)}</span>

                  {/* Actions */}
                  <div className="sp-track__actions">
                    <button
                      className={`sp-btn sp-btn--q ${queued[track.id] ? "sp-btn--queued" : ""}`}
                      onClick={() => handleQueue(track)}
                      title={queued[track.id] ? "Added!" : "Add to queue"}
                      aria-label="Add to queue"
                    >
                      {queued[track.id] ? <CheckIcon /> : <AddQueueIcon />}
                    </button>
                    <button
                      className="sp-btn sp-btn--play"
                      onClick={() => handlePlay(track)}
                      aria-label="Play now"
                    >
                      <PlayIcon /> Play
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────── */
const SearchIcon   = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242 1.156a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>;
const ClearIcon    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 5.586L11.293 1.293a1 1 0 111.414 1.414L8.414 7l4.293 4.293a1 1 0 01-1.414 1.414L7 8.414l-4.293 4.293a1 1 0 01-1.414-1.414L5.586 7 1.293 2.707a1 1 0 011.414-1.414L7 5.586z"/></svg>;
const PlayIcon     = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4V1z"/></svg>;
const AddQueueIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 3h9M1 6.5h9M1 10h5.5M10.5 8.5v4M8.5 10.5h4"/></svg>;
const CheckIcon    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l4 4 6-6"/></svg>;