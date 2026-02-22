import { useState, useEffect, useCallback } from "react";
import { spotifyGetQueue, spotifyAddToQueue, spotifyPlay } from "../hooks/useSpotifyPlayer";
import "./QueuePanel.css";

export default function QueuePanel({ accessToken, deviceId, currentTrack, onClose }) {
  const [queue,      setQueue]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await spotifyGetQueue(accessToken);
      setQueue(data.queue ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // Refresh queue when track changes
  useEffect(() => {
    if (currentTrack?.id) loadQueue(true);
  }, [currentTrack?.id, loadQueue]);

  const handlePlayFromQueue = useCallback(async (track) => {
    await spotifyPlay(accessToken, deviceId, { uris: [track.uri] });
    setTimeout(() => loadQueue(true), 800);
  }, [accessToken, deviceId, loadQueue]);

  const fmtMs = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="queue-panel">

      <div className="queue-panel__header">
        <h3 className="queue-panel__title">Up Next</h3>
        <div className="queue-panel__header-actions">
          <button
            className={`queue-panel__refresh ${refreshing ? "queue-panel__refresh--spinning" : ""}`}
            onClick={() => loadQueue(true)}
            aria-label="Refresh queue"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
          <button className="queue-panel__close" onClick={onClose} aria-label="Close queue">✕</button>
        </div>
      </div>

      {/* Now playing */}
      {currentTrack && (
        <div className="queue-panel__now">
          <p className="queue-panel__section-label">Now Playing</p>
          <div className="queue-track queue-track--current">
            <div className="queue-track__playing-bars" aria-hidden="true">
              <span /><span /><span />
            </div>
            <img
              src={currentTrack.album?.images?.[2]?.url ?? currentTrack.album?.images?.[0]?.url}
              alt=""
              className="queue-track__art"
            />
            <div className="queue-track__info">
              <p className="queue-track__name">{currentTrack.name}</p>
              <p className="queue-track__artist">{currentTrack.artists?.map(a => a.name).join(", ")}</p>
            </div>
            <span className="queue-track__badge">Playing</span>
          </div>
        </div>
      )}

      {/* Queue list */}
      <div className="queue-panel__list">
        <p className="queue-panel__section-label">
          Next {queue.length > 0 ? `· ${queue.length} track${queue.length !== 1 ? "s" : ""}` : ""}
        </p>

        {loading ? (
          <div className="queue-panel__loading">
            {[1,2,3].map(i => <div key={i} className="queue-track queue-track--skeleton" />)}
          </div>
        ) : queue.length === 0 ? (
          <div className="queue-panel__empty">
            <p>Queue is empty</p>
            <p className="queue-panel__empty-sub">Search for songs to add</p>
          </div>
        ) : (
          queue.map((track, idx) => (
            <div
              key={`${track.id}-${idx}`}
              className="queue-track"
              onDoubleClick={() => handlePlayFromQueue(track)}
              title="Double-click to play"
            >
              <span className="queue-track__num">{idx + 1}</span>
              <img
                src={track.album?.images?.[2]?.url ?? track.album?.images?.[0]?.url}
                alt=""
                className="queue-track__art"
              />
              <div className="queue-track__info">
                <p className="queue-track__name">{track.name}</p>
                <p className="queue-track__artist">{track.artists?.map(a => a.name).join(", ")}</p>
              </div>
              <span className="queue-track__duration">{fmtMs(track.duration_ms)}</span>
              <button
                className="queue-track__play-btn"
                onClick={() => handlePlayFromQueue(track)}
                title="Play now"
                aria-label={`Play ${track.name}`}
              >
                <PlayIcon />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M11.5 7A4.5 4.5 0 012.5 7H1a6 6 0 1011.94-1H11.5zm0-4.5L10 4l1.5 1.5L13 4 11.5 2.5z"/>
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