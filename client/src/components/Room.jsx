import { useState, useEffect, useCallback, useRef } from "react";
import socketService from "../socket";
import { useSpotify, fmtMs } from "../hooks/useSpotify";
import "./Room.css";

// ── Reaction config ────────────────────────────────────────
const REACTIONS = ["❤️", "🔥", "🌙", "✨", "🎵"];

// ── Waveform bar heights (deterministic) ───────────────────
const BARS = Array.from({ length: 40 }, (_, i) =>
  10 + Math.round(Math.sin(i * 0.58) * 13 + Math.cos(i * 0.31) * 10)
);

export default function Room({ roomId, onLeaveRoom, spotifyToken }) {
  // ── Spotify data ─────────────────────────────────────────
  const { track, progressMs, durationMs, isPlaying: spotifyPlaying, profile } = useSpotify(spotifyToken);

  // ── Sync state ───────────────────────────────────────────
  const [isPlaying,        setIsPlaying]        = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [latency,          setLatency]          = useState(null);

  // ── Partner state ────────────────────────────────────────
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerName,   setPartnerName]   = useState(null);
  const [partnerAvatar, setPartnerAvatar] = useState(null);

  // ── UI state ─────────────────────────────────────────────
  const [toast,            setToast]            = useState(null);   // { text, type }
  const [reactions,        setReactions]        = useState([]);     // [{id, emoji, fromPartner}]
  const [syncCelebration,  setSyncCelebration]  = useState(false);
  const [listeningSeconds, setListeningSeconds] = useState(0);
  const [showSummary,      setShowSummary]      = useState(false);
  const [sessionSongs,     setSessionSongs]     = useState(new Set());
  const [syncEvents,       setSyncEvents]       = useState(0);

  const toastTimerRef     = useRef(null);
  const syncTimerRef      = useRef(null);
  const celebTimerRef     = useRef(null);
  const listeningTimerRef = useRef(null);
  const prevTrackRef      = useRef(null);
  const lastPlayTimeRef   = useRef(null); // for "synced within 2s" detection

  // ── Track song changes for session stats ─────────────────
  useEffect(() => {
    if (!track?.id) return;
    if (track.id !== prevTrackRef.current) {
      prevTrackRef.current = track.id;
      setSessionSongs(prev => new Set([...prev, track.id]));
    }
  }, [track?.id]);

  // ── Listening timer — only runs when both online & playing ─
  useEffect(() => {
    if (isPlaying && partnerOnline) {
      listeningTimerRef.current = setInterval(() => {
        setListeningSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(listeningTimerRef.current);
    }
    return () => clearInterval(listeningTimerRef.current);
  }, [isPlaying, partnerOnline]);

  // ── Toast helper ─────────────────────────────────────────
  const showToast = useCallback((text, type = "info") => {
    clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // ── Sync celebration (play within 2s of partner) ─────────
  const triggerCelebration = useCallback(() => {
    setSyncCelebration(true);
    clearTimeout(celebTimerRef.current);
    celebTimerRef.current = setTimeout(() => setSyncCelebration(false), 2800);
  }, []);

  // ── Socket listeners ──────────────────────────────────────
  useEffect(() => {
    if (socketService.connected) setConnectionStatus("connected");

    const off = [
      socketService.on("connect",           () => setConnectionStatus("connected")),
      socketService.on("disconnect",        (r) => {
        if (r !== "io client disconnect") {
          setConnectionStatus("disconnected");
          setIsPlaying(false);
          setLatency(null);
        }
      }),
      socketService.on("reconnect_attempt", () => setConnectionStatus("reconnecting")),

      socketService.on("partner-joined", (data) => {
        setPartnerOnline(true);
        setPartnerName(data?.displayName ?? "Partner");
        setPartnerAvatar(data?.avatarUrl  ?? null);
        showToast(`${data?.displayName ?? "Partner"} joined the room 🎵`, "join");
      }),

      socketService.on("partner-left", () => {
        setPartnerOnline(false);
        showToast(`${partnerName ?? "Partner"} left the room`, "leave");
        setIsPlaying(false);
      }),

      socketService.on("sync-play", (data) => {
        if (data?.roomId && data.roomId !== roomId) return;
        const lag = data?.timestamp ? Date.now() - data.timestamp : null;
        if (lag !== null) setLatency(lag);
        setIsPlaying(true);
        setSyncEvents(n => n + 1);

        // Celebrate if partner played within 2s of us
        if (lastPlayTimeRef.current && Date.now() - lastPlayTimeRef.current < 2500) {
          triggerCelebration();
          showToast("You're in sync ♥", "sync");
        } else {
          const timeStr = track ? ` at ${fmtMs(progressMs)}` : "";
          showToast(`${partnerName ?? "Partner"} played${timeStr}`, "play");
        }
      }),

      socketService.on("sync-pause", (data) => {
        if (data?.roomId && data.roomId !== roomId) return;
        const lag = data?.timestamp ? Date.now() - data.timestamp : null;
        if (lag !== null) setLatency(lag);
        setIsPlaying(false);
        const timeStr = track ? ` at ${fmtMs(progressMs)}` : "";
        showToast(`${partnerName ?? "Partner"} paused${timeStr}`, "pause");
      }),

      socketService.on("reaction", ({ emoji } = {}) => {
        if (!emoji) return;
        const id = Date.now() + Math.random();
        setReactions(prev => [...prev, { id, emoji, fromPartner: true }]);
        setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2800);
      }),
    ];

    return () => {
      off.forEach(fn => fn());
      clearTimeout(toastTimerRef.current);
      clearTimeout(celebTimerRef.current);
      clearInterval(listeningTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, partnerName, track, progressMs]);

  // ── Playback handlers ─────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (connectionStatus !== "connected" || isPlaying) return;
    lastPlayTimeRef.current = Date.now();
    socketService.emitPlay(roomId, { progressMs });
  }, [connectionStatus, isPlaying, roomId, progressMs]);

  const handlePause = useCallback(() => {
    if (connectionStatus !== "connected" || !isPlaying) return;
    socketService.emitPause(roomId, { progressMs });
  }, [connectionStatus, isPlaying, roomId, progressMs]);

  // ── Reaction handler ──────────────────────────────────────
  const handleReaction = useCallback((emoji) => {
    socketService.emitReaction(roomId, emoji);
    const id = Date.now() + Math.random();
    setReactions(prev => [...prev, { id, emoji, fromPartner: false }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2800);
  }, [roomId]);

  // ── Leave room ────────────────────────────────────────────
  const handleLeaveAttempt = useCallback(() => {
    setShowSummary(true);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    setShowSummary(false);
    onLeaveRoom();
  }, [onLeaveRoom]);

  // ── Derived ───────────────────────────────────────────────
  const isConnected   = connectionStatus === "connected";
  const albumArt      = track?.album?.images?.[0]?.url ?? null;
  const trackName     = track?.name ?? (isPlaying ? "Listening Together" : "Ready to Sync");
  const artistName    = track?.artists?.map(a => a.name).join(", ") ?? "Duo-fy Session";
  const progressPct   = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;
  const myInitial     = profile?.name?.[0]?.toUpperCase() ?? "Y";
  const partnerInitial= (partnerName?.[0] ?? "P").toUpperCase();
  const listeningMin  = Math.floor(listeningSeconds / 60);
  const listeningSec  = listeningSeconds % 60;

  // ── Mood aura color based on tempo/energy heuristic ──────
  const auraColor = isPlaying
    ? (track?.name?.toLowerCase().match(/love|heart|tender|soft|calm|sleep|night/)
        ? "aura-romantic"
        : track?.name?.toLowerCase().match(/fire|power|run|fast|energy|hype|up/)
          ? "aura-energy"
          : "aura-default")
    : "";

  return (
    <div className={`room-shell ${auraColor} ${syncCelebration ? "room-shell--celebrating" : ""}`}>

      {/* ── Ambient background orbs ─────────────────────── */}
      <div className="room-orb room-orb--purple" />
      <div className="room-orb room-orb--rose"   />
      {syncCelebration && <div className="room-orb room-orb--celebrate" />}

      {/* ── Album art as blurred background (mobile) ────── */}
      {albumArt && (
        <div
          className="room-bg-art"
          style={{ backgroundImage: `url(${albumArt})` }}
          aria-hidden="true"
        />
      )}

      {/* ── Floating reactions ───────────────────────────── */}
      <div className="room-reactions-stage" aria-hidden="true">
        {reactions.map(r => (
          <span
            key={r.id}
            className={`room-reaction ${r.fromPartner ? "room-reaction--partner" : "room-reaction--self"}`}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* ── Toast notification ──────────────────────────── */}
      {toast && (
        <div className={`room-toast room-toast--${toast.type}`} role="status" aria-live="polite">
          <span className="room-toast__dot" />
          {toast.text}
        </div>
      )}

      {/* ── Sync celebration overlay ─────────────────────── */}
      {syncCelebration && (
        <div className="room-celebration" aria-hidden="true">
          <div className="room-celebration__ripple room-celebration__ripple--1" />
          <div className="room-celebration__ripple room-celebration__ripple--2" />
          <div className="room-celebration__ripple room-celebration__ripple--3" />
          <p className="room-celebration__text">You're in sync ♥</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <aside className="room-sidebar">
        <div className="room-sidebar__top">

          {/* Logo */}
          <a href="/" className="room-sidebar__brand">
            <img src="/duo-fy-icon.png" alt="" className="room-sidebar__logo" />
            <span className="room-sidebar__brand-name">Duo-fy</span>
          </a>

          {/* Room code */}
          <div className="room-sidebar__block">
            <p className="room-sidebar__label">Room Code</p>
            <div className="room-sidebar__code-row">
              <code className="room-sidebar__code">{roomId}</code>
              <button
                className="room-sidebar__icon-btn"
                onClick={() => { navigator.clipboard?.writeText(roomId); showToast("Copied!", "info"); }}
                title="Copy room code"
              >
                <CopyIcon />
              </button>
            </div>
          </div>

          {/* Partner block */}
          <div className="room-sidebar__block">
            <p className="room-sidebar__label">Partner</p>
            <div className="room-sidebar__partner-row">
              <div className={`room-sidebar__avatar ${partnerOnline ? "room-sidebar__avatar--on" : ""}`}>
                {partnerAvatar
                  ? <img src={partnerAvatar} alt={partnerName} className="room-sidebar__avatar-img" />
                  : <span>{partnerOnline ? partnerInitial : "?"}</span>
                }
                <span className={`room-sidebar__avatar-dot ${partnerOnline ? "room-sidebar__avatar-dot--on" : ""}`} />
              </div>
              <div>
                <p className="room-sidebar__partner-name">{partnerOnline ? (partnerName ?? "Partner") : "Waiting…"}</p>
                <p className="room-sidebar__partner-status">
                  {partnerOnline ? "Connected" : "Share code to invite"}
                </p>
              </div>
            </div>
          </div>

          {/* Listening timer */}
          {listeningSeconds > 0 && (
            <div className="room-sidebar__block">
              <p className="room-sidebar__label">Together for</p>
              <p className="room-sidebar__timer">
                {listeningMin > 0 ? `${listeningMin}m ` : ""}{listeningSec}s
              </p>
            </div>
          )}
        </div>

        {/* Bottom: connection + leave */}
        <div className="room-sidebar__bottom">
          <div className="room-sidebar__conn">
            <span className={`room-sidebar__conn-dot ${isConnected ? "room-sidebar__conn-dot--live" : ""}`} />
            <span className="room-sidebar__conn-label">
              {isConnected ? "Live" : connectionStatus === "reconnecting" ? "Reconnecting…" : "Offline"}
            </span>
            {latency !== null && <span className="room-sidebar__latency">{latency}ms</span>}
          </div>
          <button className="room-sidebar__leave" onClick={handleLeaveAttempt}>
            <LeaveIcon /> Leave Room
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════ */}
      <main className="room-main">

        {/* ── Avatar pair with heartbeat connector ──────── */}
        <div className="room-avatars">
          {/* My avatar */}
          <div className="room-avatar-wrap">
            <div className={`room-avatar room-avatar--me ${isPlaying ? "room-avatar--playing" : ""}`}>
              {profile?.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.name} />
                : <span>{myInitial}</span>
              }
            </div>
            <p className="room-avatar-name">{profile?.name ?? "You"}</p>
          </div>

          {/* Connector / heartbeat */}
          <div className={`room-connector ${partnerOnline ? "room-connector--on" : ""} ${isPlaying ? "room-connector--beating" : ""}`}>
            <div className="room-connector__line" />
            <div className="room-connector__pulse" />
            <div className="room-connector__line" />
          </div>

          {/* Partner avatar */}
          <div className="room-avatar-wrap">
            <div className={`room-avatar room-avatar--partner ${partnerOnline ? "room-avatar--online" : "room-avatar--offline"}`}>
              {partnerOnline
                ? (partnerAvatar
                    ? <img src={partnerAvatar} alt={partnerName} />
                    : <span>{partnerInitial}</span>)
                : <span className="room-avatar--waiting-icon">?</span>
              }
              {partnerOnline && <span className="room-avatar__online-ring" />}
            </div>
            <p className="room-avatar-name">{partnerOnline ? (partnerName ?? "Partner") : "Waiting…"}</p>
          </div>
        </div>

        {/* ── Player Card ───────────────────────────────── */}
        <div className={`room-card ${isPlaying ? "room-card--playing" : ""} ${syncCelebration ? "room-card--synced" : ""}`}>

          {/* Album art */}
          <div className={`room-card__art-wrap ${isPlaying ? "room-card__art-wrap--playing" : ""}`}>
            {albumArt ? (
              <img src={albumArt} alt={`${trackName} album art`} className="room-card__art" />
            ) : (
              <div className="room-card__art-placeholder">
                <MusicPlaceholder />
              </div>
            )}
            {isPlaying && <div className="room-card__art-glow" />}
          </div>

          {/* Track info */}
          <div className="room-card__info">
            <h2 className="room-card__track">{trackName}</h2>
            <p className="room-card__artist">{artistName}</p>

            {/* Sync badge */}
            <div className="room-card__badges">
              <span className={`room-card__badge ${isPlaying ? "room-card__badge--synced" : ""}`}>
                {isPlaying ? "✓ Synced" : "○ Paused"}
              </span>
              {latency !== null && (
                <span className={`room-card__badge room-card__badge--latency ${latency < 80 ? "room-card__badge--good" : latency < 200 ? "room-card__badge--ok" : "room-card__badge--slow"}`}>
                  {latency}ms
                </span>
              )}
              {partnerOnline && isPlaying && (
                <span className="room-card__badge room-card__badge--ready">✓ Both Ready</span>
              )}
            </div>
          </div>

          {/* Waveform */}
          <div className="room-card__waveform" aria-hidden="true">
            {BARS.map((h, i) => (
              <div
                key={i}
                className={`room-card__bar ${isPlaying ? "room-card__bar--playing" : ""}`}
                style={{
                  height:            isPlaying ? `${h}px` : "4px",
                  animationDelay:    `${(i * 0.055).toFixed(2)}s`,
                  animationDuration: `${0.65 + (i % 5) * 0.13}s`,
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="room-card__progress-section">
            <div
              className="room-card__progress-track"
              role="progressbar"
              aria-valuenow={Math.round(progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="room-card__progress-fill" style={{ width: `${progressPct}%` }}>
                <div className="room-card__progress-thumb" />
              </div>
            </div>
            <div className="room-card__times">
              <span>{fmtMs(progressMs)}</span>
              <span>{fmtMs(durationMs)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="room-card__controls">
            <button className="room-card__ctrl-sm" disabled aria-label="Previous">
              <PrevIcon />
            </button>

            <button
              className={`room-card__play-btn ${isPlaying ? "room-card__play-btn--pause" : "room-card__play-btn--play"} ${syncCelebration ? "room-card__play-btn--synced" : ""}`}
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={!isConnected}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIconLg /> : <PlayIconLg />}
              {syncCelebration && <div className="room-card__play-btn-ring" />}
            </button>

            <button className="room-card__ctrl-sm" disabled aria-label="Next">
              <NextIcon />
            </button>
          </div>

          {/* Reactions */}
          <div className="room-card__reactions" aria-label="Send a reaction">
            {REACTIONS.map(emoji => (
              <button
                key={emoji}
                className="room-card__reaction-btn"
                onClick={() => handleReaction(emoji)}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

        </div>

      </main>

      {/* ══════════════════════════════════════════════════════
          BOTTOM PLAYER BAR
      ══════════════════════════════════════════════════════ */}
      <div className="room-bar">
        <div className="room-bar__left">
          {albumArt
            ? <img src={albumArt} alt="" className="room-bar__art" />
            : <div className="room-bar__art-placeholder"><MusicIcon /></div>
          }
          <div className="room-bar__track-info">
            <p className="room-bar__track">{trackName}</p>
            <p className="room-bar__artist">{artistName}</p>
          </div>
        </div>

        <div className="room-bar__center">
          <button className="room-bar__ctrl" disabled><PrevIcon /></button>
          <button
            className={`room-bar__ctrl room-bar__ctrl--main ${isPlaying ? "room-bar__ctrl--playing" : ""}`}
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={!isConnected}
          >
            {isPlaying ? <PauseIconSm /> : <PlayIconSm />}
          </button>
          <button className="room-bar__ctrl" disabled><NextIcon /></button>
        </div>

        <div className="room-bar__right">
          {listeningSeconds > 60 && (
            <span className="room-bar__together">
              Together {listeningMin}m{listeningSec > 0 ? ` ${listeningSec}s` : ""}
            </span>
          )}
          <div className={`room-bar__status ${isPlaying ? "room-bar__status--live" : ""}`}>
            <span className="room-bar__status-dot" />
            {isPlaying ? "Live" : "Ready"}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SESSION SUMMARY MODAL
      ══════════════════════════════════════════════════════ */}
      {showSummary && (
        <div className="room-summary-overlay" onClick={(e) => e.target === e.currentTarget && setShowSummary(false)}>
          <div className="room-summary">
            <div className="room-summary__icon">🎵</div>
            <h2 className="room-summary__title">Session Complete</h2>
            <p className="room-summary__sub">Here's how your listening session went</p>

            <div className="room-summary__stats">
              <div className="room-summary__stat">
                <span className="room-summary__stat-value">
                  {listeningMin > 0 ? `${listeningMin}m` : `${listeningSeconds}s`}
                </span>
                <span className="room-summary__stat-label">Together</span>
              </div>
              <div className="room-summary__stat">
                <span className="room-summary__stat-value">{sessionSongs.size}</span>
                <span className="room-summary__stat-label">Songs</span>
              </div>
              <div className="room-summary__stat">
                <span className="room-summary__stat-value">{syncEvents}</span>
                <span className="room-summary__stat-label">Syncs</span>
              </div>
            </div>

            {listeningSeconds > 0 && (
              <p className="room-summary__message">
                {listeningMin >= 30
                  ? "That's a full album's worth of togetherness ♥"
                  : listeningMin >= 10
                    ? "Great listening session — same songs, same moment ♥"
                    : "Every moment together counts ♥"}
              </p>
            )}

            <div className="room-summary__actions">
              <button className="btn-primary room-summary__confirm" onClick={handleConfirmLeave}>
                Leave Room
              </button>
              <button className="btn-ghost room-summary__cancel" onClick={() => setShowSummary(false)}>
                Keep Listening
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────── */
function CopyIcon()         { return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3.5 1A1.5 1.5 0 002 2.5v6A1.5 1.5 0 003.5 10h5A1.5 1.5 0 0010 8.5v-6A1.5 1.5 0 008.5 1h-5zm0 1h5a.5.5 0 01.5.5v6a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-6a.5.5 0 01.5-.5z"/></svg>; }
function LeaveIcon()        { return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M9.5 2.5h-7v9h7v-2h1v2a1 1 0 01-1 1h-7a1 1 0 01-1-1v-9a1 1 0 011-1h7a1 1 0 011 1v2h-1v-2zm.646 2.646l2.5 2.5a.5.5 0 010 .708l-2.5 2.5a.5.5 0 01-.708-.708L11.293 8.5H5a.5.5 0 010-1h6.293L9.438 5.854a.5.5 0 11.708-.708z"/></svg>; }
function PrevIcon()         { return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 3.5h1.5v9H3.5V3.5zm1.5 4.5L13 3.5v9L5 8z"/></svg>; }
function NextIcon()         { return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.5 3.5H11v9h1.5V3.5zM11 8L3 3.5v9L11 8z"/></svg>; }
function PlayIconLg()       { return <svg width="30" height="30" viewBox="0 0 30 30" fill="currentColor"><path d="M7 4l18 11L7 26V4z"/></svg>; }
function PauseIconLg()      { return <svg width="30" height="30" viewBox="0 0 30 30" fill="currentColor"><rect x="5" y="4" width="8" height="22" rx="2"/><rect x="17" y="4" width="8" height="22" rx="2"/></svg>; }
function PlayIconSm()       { return <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M3 2l10 5.5L3 13V2z"/></svg>; }
function PauseIconSm()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="2" y="2" width="4.5" height="11" rx="1"/><rect x="8.5" y="2" width="4.5" height="11" rx="1"/></svg>; }
function MusicIcon()        { return <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9 3v10.55A3 3 0 1010 17V7h5V3H9z"/></svg>; }
function MusicPlaceholder() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" stroke="url(#pg1)" strokeWidth="1.5" strokeDasharray="6 4" />
      <circle cx="32" cy="32" r="18" fill="url(#pg2)" opacity="0.45" />
      <circle cx="32" cy="32" r="7"  fill="white"      opacity="0.8"  />
      <defs>
        <linearGradient id="pg1" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ff6eb4"/><stop offset="1" stopColor="#a855f7"/>
        </linearGradient>
        <linearGradient id="pg2" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#a855f7"/><stop offset="1" stopColor="#3b82f6"/>
        </linearGradient>
      </defs>
    </svg>
  );
}