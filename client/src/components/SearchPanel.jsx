/**
 * src/components/SearchPanel.jsx
 *
 * Full-screen Spotify search overlay.
 * Debounced query → instant results → play now or add to queue.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { spotifySearch, spotifyPlay, spotifyAddToQueue } from "../hooks/useSpotifyPlayer";
import "./SearchPanel.css";

export default function SearchPanel({ accessToken, deviceId, onClose, onTrackPlay }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queued,  setQueued]  = useState({}); // trackId → true

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  useEffect(() => {
    const handleKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const tracks = await spotifySearch(accessToken, query);
      setResults(tracks);
      setLoading(false);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, accessToken]);

  const handlePlay = useCallback(async track => {
    await spotifyPlay(accessToken, deviceId, { uris: [track.uri] }).catch(() => {});
    onTrackPlay?.(track);
    onClose();
  }, [accessToken, deviceId, onClose, onTrackPlay]);

  const handleQueue = useCallback(async track => {
    await spotifyAddToQueue(accessToken, track.uri).catch(() => {});
    setQueued(p => ({ ...p, [track.id]: true }));
    setTimeout(() => setQueued(p => { const n = { ...p }; delete n[track.id]; return n; }), 2200);
  }, [accessToken]);

  const fmt = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  return (
    <div className="sp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sp-panel">

        {/* Search input */}
        <div className="sp-header">
          <div className="sp-input-wrap">
            <svg className="sp-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.018-.784zm-5.242 1.156a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/>
            </svg>
            <input
              ref={inputRef}
              className="sp-input"
              type="text"
              placeholder="Search songs, artists, albums…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            {loading && <div className="sp-spinner" />}
            {query && !loading && (
              <button className="sp-clear" onClick={() => setQuery("")}>✕</button>
            )}
          </div>
          <button className="sp-cancel" onClick={onClose}>Cancel</button>
        </div>

        {/* Results */}
        <div className="sp-results">
          {!query && (
            <div className="sp-empty">
              <div className="sp-empty-icon">🔍</div>
              <p>Search for a song to play together</p>
            </div>
          )}

          {query && !loading && results.length === 0 && (
            <div className="sp-empty">
              <div className="sp-empty-icon">🎵</div>
              <p>No results for "{query}"</p>
            </div>
          )}

          {results.map(track => (
            <div key={track.id} className="sp-track">
              <img
                src={track.album?.images?.[2]?.url ?? track.album?.images?.[0]?.url ?? ""}
                alt=""
                className="sp-track__art"
              />
              <div className="sp-track__info">
                <p className="sp-track__name">{track.name}</p>
                <p className="sp-track__meta">
                  {track.artists.map(a => a.name).join(", ")}
                  <span className="sp-track__dot">·</span>
                  {track.album.name}
                </p>
              </div>
              <span className="sp-track__dur">{fmt(track.duration_ms)}</span>
              <div className="sp-track__actions">
                <button
                  className={`sp-btn sp-btn--queue ${queued[track.id] ? "sp-btn--queued" : ""}`}
                  onClick={() => handleQueue(track)}
                  title="Add to queue"
                >
                  {queued[track.id] ? "✓" : (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                      <path d="M1 2.5h9M1 5.5h9M1 8.5h5M9.5 8v4M7.5 10h4"/>
                    </svg>
                  )}
                </button>
                <button className="sp-btn sp-btn--play" onClick={() => handlePlay(track)}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4V1z"/></svg>
                  Play
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}