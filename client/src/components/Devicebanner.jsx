/**
 * src/components/DeviceBanner.jsx
 *
 * Honest, clear communication about where audio is playing.
 * Three states: connecting → premium-error → (hidden when ready)
 */
import "./DeviceBanner.css";

export default function DeviceBanner({ playerReady, playerError, onDismiss }) {
  if (playerReady) return null;

  if (playerError?.includes("Premium")) {
    return (
      <div className="dbanner dbanner--warn" role="alert">
        <div className="dbanner__icon">📱</div>
        <div className="dbanner__body">
          <p className="dbanner__title">Audio playing on Spotify app</p>
          <p className="dbanner__desc">
            Browser audio needs <strong>Spotify Premium</strong>. Sync, search, and controls
            all work — open Spotify on any device to hear the music.
          </p>
        </div>
        <button className="dbanner__close" onClick={onDismiss} aria-label="Dismiss">✕</button>
      </div>
    );
  }

  if (playerError) {
    return (
      <div className="dbanner dbanner--error" role="alert">
        <div className="dbanner__icon">⚠️</div>
        <div className="dbanner__body">
          <p className="dbanner__title">Browser player unavailable</p>
          <p className="dbanner__desc">{playerError}</p>
        </div>
        <button className="dbanner__close" onClick={onDismiss} aria-label="Dismiss">✕</button>
      </div>
    );
  }

  return (
    <div className="dbanner dbanner--connecting" role="status">
      <div className="dbanner__spinner" />
      <div className="dbanner__body">
        <p className="dbanner__title">Connecting browser player…</p>
        <p className="dbanner__desc">Requires Spotify Premium. Music will play here once connected.</p>
      </div>
    </div>
  );
}