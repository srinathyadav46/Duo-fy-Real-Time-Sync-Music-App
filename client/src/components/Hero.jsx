/**
 * Hero.jsx — Redesigned
 *
 * Changes:
 * - Two-column layout: left = headline/CTAs, right = floating UI preview card
 * - Right side shows a decorative "Now Listening" card with waveform bars,
 *   avatar rings, and a fake track — sells the product at a glance
 * - Improved badge with animated dot using correct CSS class
 * - All existing props and logic preserved
 */

import './Hero.css';

// Deterministic bar heights for the decorative waveform
const WAVE_BARS = [18, 28, 22, 36, 24, 40, 30, 20, 38, 26, 34, 18, 42, 28, 22, 36, 24, 38, 20, 32];

export default function Hero({ onCreateRoom, onJoinRoom, loading = false, spotifyToken }) {
  return (
    <section className="hero-root" aria-labelledby="hero-heading">

      {/* ── Left Column ─────────────────────────────────────── */}
      <div className="hero">

        {/* Live badge */}
        <div className="hero__badge animate-fade-up delay-1" aria-label="Real-time sync active">
          <span className="hero__badge-dot animate-dot-pulse" aria-hidden="true" />
          Real-time music sync — now live
        </div>

        {/* Heading */}
        <h1 className="hero__heading animate-fade-up delay-2" id="hero-heading">
          Listen{' '}
          <span className="accent-text">Together.</span>
        </h1>

        {/* Subtitle */}
        <p className="hero__subtitle animate-fade-up delay-3">
          Sync music in real time with someone you love.
          <br className="hero__subtitle-break" />
          Same song. Same moment. Different places.
        </p>

        {/* CTAs */}
        <div className="hero__actions animate-fade-up delay-4" role="group" aria-label="Room actions">
          <button
            className="btn-primary hero__btn-create shimmer"
            onClick={onCreateRoom}
            disabled={loading}
            aria-label={loading ? "Creating room…" : "Create a new room"}
            aria-busy={loading}
          >
            {loading ? (
              <svg className="hero__btn-icon hero__btn-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
              </svg>
            ) : (
              <svg className="hero__btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.5 5V5.5a.5.5 0 00-1 0V7H6a.5.5 0 000 1h1.5v1.5a.5.5 0 001 0V8H10a.5.5 0 000-1H8.5z" />
              </svg>
            )}
            {loading ? "Creating…" : "Create Room"}
          </button>

          <button
            className="btn-secondary hero__btn-join"
            onClick={onJoinRoom}
            disabled={loading}
            aria-label="Join an existing room"
          >
            <svg className="hero__btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M1 8a7 7 0 1114 0A7 7 0 011 8zm7-6a6 6 0 100 12A6 6 0 008 2zm-.5 3.5a.5.5 0 011 0v3.793l1.646-1.647a.5.5 0 01.708.708l-2.5 2.5a.5.5 0 01-.708 0l-2.5-2.5a.5.5 0 01.708-.708L7.5 9.293V5.5z" />
            </svg>
            Join a Room
          </button>
        </div>

        {/* Stats */}
        <dl className="hero__stats animate-fade-up delay-5" aria-label="App statistics">
          <div className="hero__stat">
            <dt className="hero__stat-label">Couples Synced</dt>
            <dd className="hero__stat-value">12K+</dd>
          </div>
          <div className="hero__stat-divider" aria-hidden="true" />
          <div className="hero__stat">
            <dt className="hero__stat-label">Sync Accuracy</dt>
            <dd className="hero__stat-value">98%</dd>
          </div>
          <div className="hero__stat-divider" aria-hidden="true" />
          <div className="hero__stat">
            <dt className="hero__stat-label">Avg Latency</dt>
            <dd className="hero__stat-value">&lt;50ms</dd>
          </div>
        </dl>
      </div>

      {/* ── Right Column — Decorative Preview ───────────────── */}
      <div className="hero-preview animate-fade-up delay-3" aria-hidden="true">

        {/* Outer glow ring */}
        <div className="hero-preview__ring" />

        {/* Main now-playing card */}
        <div className="hero-preview__card">

          {/* Card header */}
          <div className="hero-preview__card-header">
            <div className="hero-preview__listening-badge">
              <span className="hero-preview__dot" />
              Now Listening
            </div>
            <span className="hero-preview__latency">12ms</span>
          </div>

          {/* Album art placeholder */}
          <div className="hero-preview__album">
            <div className="hero-preview__album-art">
              {/* Abstract album cover with gradient rings */}
              <div className="hero-preview__album-inner">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="22" stroke="url(#aGrad)" strokeWidth="1.5" strokeDasharray="4 3" />
                  <circle cx="24" cy="24" r="14" fill="url(#bGrad)" opacity="0.6" />
                  <circle cx="24" cy="24" r="5" fill="white" opacity="0.9" />
                  <defs>
                    <linearGradient id="aGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop stopColor="#ff6eb4" /><stop offset="1" stopColor="#a855f7" />
                    </linearGradient>
                    <linearGradient id="bGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop stopColor="#a855f7" /><stop offset="1" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Track info */}
            <div className="hero-preview__track-info">
              <p className="hero-preview__track-name">Somewhere Only We Know</p>
              <p className="hero-preview__track-artist">Keane</p>
            </div>
          </div>

          {/* Waveform */}
          <div className="hero-preview__waveform">
            {WAVE_BARS.map((h, i) => (
              <div
                key={i}
                className="hero-preview__bar"
                style={{
                  height: `${h}px`,
                  animationDelay: `${(i * 0.07).toFixed(2)}s`,
                  animationDuration: `${0.8 + (i % 4) * 0.15}s`,
                }}
              />
            ))}
          </div>

          {/* Progress */}
          <div className="hero-preview__progress-row">
            <span>1:24</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '38%' }}>
                <div className="progress-thumb" />
              </div>
            </div>
            <span>3:57</span>
          </div>
        </div>

        {/* Floating partner pill */}
        <div className="hero-preview__partner">
          <div className="hero-preview__avatars">
            <div className="hero-preview__avatar hero-preview__avatar--a">Y</div>
            <div className="hero-preview__avatar hero-preview__avatar--b">J</div>
          </div>
          <div>
            <p className="hero-preview__partner-label">Listening together</p>
            <p className="hero-preview__partner-sub">2 listeners · synced</p>
          </div>
        </div>

        {/* Floating latency pill */}
        <div className="hero-preview__latency-pill">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="5" cy="5" r="5" />
          </svg>
          Live sync
        </div>

      </div>

    </section>
  );
}