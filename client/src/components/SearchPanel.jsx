import { useState, useEffect, useRef, useCallback } from "react";
import { spotifySearch, spotifyPlay, spotifyAddToQueue } from "../hooks/useSpotifyPlayer";
import "./SearchPanel.css";

export default function SearchPanel({ accessToken, deviceId, onClose, onTrackPlay }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queued,  setQueued]  = useState({}); // trackId → true for toast

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  // Focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const tracks = await spotifySearch(accessToken, query);
      setResults(tracks);
      setLoading(false);
    }, 380);

    return () => clearTimeout(debounceRef.current);
  }, [query, accessToken]);

  const handlePlay = useCallback(async (track) => {
    await spotifyPlay(accessToken, deviceId, { uris: [track.uri] });
    onTrackPlay?.(track);
    onClose();
  }, [accessToken, deviceId, onClose, onTrackPlay]);

  const handleAddQueue = useCallback(async (track) => {
    await spotifyAddToQueue(accessToken, track.uri);
    setQueued(prev => ({ ...prev, [track.id]: true }));
    setTimeout(() => setQueued(prev => { const n = { ...prev }; delete n[track.id]; return n; }), 2000);
  }, [accessToken]);

  const fmtDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="search-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-panel">

        {/* Header */}
        <div className="search-panel__header">
          <div className="search-panel__input-wrap">
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              className="search-panel__input"
              placeholder="Search songs, artists…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            {loading && <div className="search-panel__spinner" />}
            {query && !loading && (
              <button className="search-panel__clear" onClick={() => setQuery("")} aria-label="Clear">✕</button>
            )}
          </div>
          <button className="search-panel__close" onClick={onClose} aria-label="Close search">Cancel</button>
        </div>

        {/* Results */}
        <div className="search-panel__results">
          {!query && (
            <div className="search-panel__empty">
              <p className="search-panel__empty-icon">🎵</p>
              <p className="search-panel__empty-text">Search for a song to play together</p>
            </div>
          )}

          {query && !loading && results.length === 0 && (
            <div className="search-panel__empty">
              <p className="search-panel__empty-icon">🔍</p>
              <p className="search-panel__empty-text">No results for "{query}"</p>
            </div>
          )}

          {results.map((track) => (
            <div key={track.id} className="search-result">
              <img
                src={track.album?.images?.[2]?.url ?? track.album?.images?.[0]?.url}
                alt=""
                className="search-result__art"
              />
              <div className="search-result__info">
                <p className="search-result__name">{track.name}</p>
                <p className="search-result__meta">
                  {track.artists.map(a => a.name).join(", ")}
                  <span className="search-result__dot">·</span>
                  {track.album.name}
                </p>
              </div>
              <span className="search-result__duration">{fmtDuration(track.duration_ms)}</span>
              <div className="search-result__actions">
                <button
                  className="search-result__btn search-result__btn--queue"
                  onClick={() => handleAddQueue(track)}
                  title="Add to queue"
                >
                  {queued[track.id] ? "✓" : <QueueIcon />}
                </button>
                <button
                  className="search-result__btn search-result__btn--play"
                  onClick={() => handlePlay(track)}
                  title="Play now"
                >
                  <PlayIcon />
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.099zm-5.242 1.156a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
      <path d="M2 1l8 4.5L2 10V1z"/>
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M1 2.5h10M1 5.5h10M1 8.5h6M10 8l2 2-2 2V8z"/>
      <path d="M1 2.5h10M1 5.5h10M1 8.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M10.5 8v5M8 10.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}