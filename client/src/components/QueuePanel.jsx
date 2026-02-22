/**
 * src/components/QueuePanel.jsx
 * Live queue: now playing + up next. Refreshes when track changes.
 */
import { useState, useEffect, useCallback } from "react";
import { spotifyGetQueue, spotifyPlay } from "../hooks/useSpotifyPlayer";
import "./QueuePanel.css";

export default function QueuePanel({ accessToken, deviceId, currentTrack, onClose }) {
  const [queue,   setQueue]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await spotifyGetQueue(accessToken);
      setQueue(data.queue ?? []);
    } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (currentTrack?.id) load(true); }, [currentTrack?.id, load]);

  const handlePlay = useCallback(async track => {
    await spotifyPlay(accessToken, deviceId, { uris: [track.uri] }).catch(() => {});
    setTimeout(() => load(true), 900);
  }, [accessToken, deviceId, load]);

  const fmt = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  return (
    <div className="qp">
      <div className="qp__header">
        <h3 className="qp__title">Up Next</h3>
        <div className="qp__header-right">
          <button className="qp__icon-btn" onClick={() => load(true)} title="Refresh">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <path d="M10.5 6.5A4 4 0 112.5 6.5H1a5.5 5.5 0 1010.94-1H10.5zm0-4L9 4l1.5 1.5L12 4 10.5 2.5z"/>
            </svg>
          </button>
          <button className="qp__icon-btn" onClick={onClose} aria-label="Close queue">✕</button>
        </div>
      </div>

      <div className="qp__body">
        {/* Now playing */}
        {currentTrack && (
          <div className="qp__section">
            <p className="qp__section-label">Now Playing</p>
            <div className="qp__track qp__track--current">
              <div className="qp__bars" aria-hidden="true">
                <span /><span /><span />
              </div>
              <img
                src={currentTrack.album?.images?.[2]?.url ?? currentTrack.album?.images?.[0]?.url ?? ""}
                alt=""
                className="qp__art"
              />
              <div className="qp__info">
                <p className="qp__name">{currentTrack.name}</p>
                <p className="qp__artist">{currentTrack.artists?.map(a => a.name).join(", ")}</p>
              </div>
              <span className="qp__badge">Playing</span>
            </div>
          </div>
        )}

        {/* Queue */}
        <div className="qp__section">
          <p className="qp__section-label">
            Next {queue.length > 0 ? `· ${queue.length} track${queue.length !== 1 ? "s" : ""}` : ""}
          </p>

          {loading ? (
            [1,2,3].map(i => <div key={i} className="qp__skeleton" />)
          ) : queue.length === 0 ? (
            <div className="qp__empty">
              <p>Queue is empty</p>
              <p className="qp__empty-sub">Search for songs to add</p>
            </div>
          ) : (
            queue.map((track, i) => (
              <div key={`${track.id}-${i}`} className="qp__track" onDoubleClick={() => handlePlay(track)}>
                <span className="qp__num">{i + 1}</span>
                <img
                  src={track.album?.images?.[2]?.url ?? track.album?.images?.[0]?.url ?? ""}
                  alt=""
                  className="qp__art"
                />
                <div className="qp__info">
                  <p className="qp__name">{track.name}</p>
                  <p className="qp__artist">{track.artists?.map(a => a.name).join(", ")}</p>
                </div>
                <span className="qp__dur">{fmt(track.duration_ms)}</span>
                <button className="qp__play" onClick={() => handlePlay(track)} title="Play now">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4V1z"/></svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
