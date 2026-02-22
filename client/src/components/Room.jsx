import { useState, useEffect, useCallback, useRef } from "react";
import socketService from "../socket";
import { useSpotify, fmtMs } from "../hooks/useSpotify";
import { useSpotifyPlayer, spotifyPlay, spotifyPause, spotifySkipNext, spotifySkipPrev } from "../hooks/useSpotifyPlayer";
import SearchPanel  from "./SearchPanel";
import QueuePanel   from "./QueuePanel";
import DeviceBanner from "./Devicebanner";
import "./Room.css";

const REACTIONS = ["❤️", "🔥", "🌙", "✨", "🎵"];
const BARS = Array.from({ length: 36 }, (_, i) =>
  8 + Math.round(Math.abs(Math.sin(i * 0.61 + 0.3)) * 20 + Math.cos(i * 0.38) * 8)
);

export default function Room({ roomId, onLeaveRoom, spotifyToken }) {
  // ── Spotify ───────────────────────────────────────────────
  const { track, progressMs, durationMs, isPlaying: spotifyIsPlaying, profile } =
    useSpotify(spotifyToken);
  const { deviceId, playerReady, playerError, volume, setVolume } =
    useSpotifyPlayer(spotifyToken);

  // ── Sync state ─────────────────────────────────────────────
  const [syncPlaying,  setSyncPlaying]  = useState(false);
  const [connStatus,   setConnStatus]   = useState("connecting");
  const [latency,      setLatency]      = useState(null);

  // ── Partner ────────────────────────────────────────────────
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerName,   setPartnerName]   = useState(null);
  const [partnerAvatar, setPartnerAvatar] = useState(null);

  // ── Panels ─────────────────────────────────────────────────
  const [showSearch,      setShowSearch]      = useState(false);
  const [showQueue,       setShowQueue]       = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showSummary,     setShowSummary]     = useState(false);

  // ── Toast / reactions / celebration ────────────────────────
  const [toast,           setToast]           = useState(null);
  const [reactions,       setReactions]       = useState([]);
  const [celebrating,     setCelebrating]     = useState(false);

  // ── Session stats ──────────────────────────────────────────
  const [listeningSecs, setListeningSecs] = useState(0);
  const [sessionSongs,  setSessionSongs]  = useState(new Set());
  const [syncCount,     setSyncCount]     = useState(0);

  // ── Refs ───────────────────────────────────────────────────
  const toastTimerRef  = useRef(null);
  const celebTimerRef  = useRef(null);
  const listenRef      = useRef(null);
  const lastPlayRef    = useRef(null);
  const prevTrackRef   = useRef(null);

  // Track session songs
  useEffect(() => {
    if (track?.id && track.id !== prevTrackRef.current) {
      prevTrackRef.current = track.id;
      setSessionSongs(p => new Set([...p, track.id]));
    }
  }, [track?.id]);

  // Listening timer — only when both online AND playing
  useEffect(() => {
    if (syncPlaying && partnerOnline) {
      listenRef.current = setInterval(() => setListeningSecs(s => s + 1), 1000);
    } else {
      clearInterval(listenRef.current);
    }
    return () => clearInterval(listenRef.current);
  }, [syncPlaying, partnerOnline]);

  // Toast
  const showToast = useCallback((text, type = "info") => {
    clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Celebration
  const celebrate = useCallback(() => {
    setCelebrating(true);
    clearTimeout(celebTimerRef.current);
    celebTimerRef.current = setTimeout(() => setCelebrating(false), 3000);
  }, []);

  // Floating reaction
  const addReaction = useCallback((emoji, fromPartner) => {
    const id = Date.now() + Math.random();
    setReactions(p => [...p, { id, emoji, fromPartner }]);
    setTimeout(() => setReactions(p => p.filter(r => r.id !== id)), 2800);
  }, []);

  // ── Socket listeners ───────────────────────────────────────
  useEffect(() => {
    if (socketService.connected) setConnStatus("connected");

    const offs = [
      socketService.on("connect",           ()  => setConnStatus("connected")),
      socketService.on("disconnect",        (r) => {
        if (r !== "io client disconnect") { setConnStatus("disconnected"); setSyncPlaying(false); }
      }),
      socketService.on("reconnect_attempt", () => setConnStatus("reconnecting")),

      socketService.on("partner-joined", (data) => {
        setPartnerOnline(true);
        setPartnerName(data?.displayName ?? "Partner");
        setPartnerAvatar(data?.avatarUrl ?? null);
        showToast(`${data?.displayName ?? "Partner"} joined the room 🎵`, "join");
      }),

      socketService.on("partner-left", () => {
        setPartnerOnline(false);
        setSyncPlaying(false);
        showToast(`${partnerName ?? "Partner"} left the room`, "leave");
      }),

      socketService.on("sync-play", async (data) => {
        if (data?.roomId && data.roomId !== roomId) return;
        const lag = data?.timestamp ? Date.now() - data.timestamp : null;
        if (lag !== null) setLatency(lag);
        setSyncPlaying(true);
        setSyncCount(n => n + 1);
        if (deviceId) await spotifyPlay(spotifyToken, deviceId).catch(() => {});
        if (lastPlayRef.current && Date.now() - lastPlayRef.current < 2500) {
          celebrate();
          showToast("You're in sync ♥", "sync");
        } else {
          const t = track ? ` at ${fmtMs(progressMs)}` : "";
          showToast(`${partnerName ?? "Partner"} played${t}`, "play");
        }
      }),

      socketService.on("sync-pause", async (data) => {
        if (data?.roomId && data.roomId !== roomId) return;
        const lag = data?.timestamp ? Date.now() - data.timestamp : null;
        if (lag !== null) setLatency(lag);
        setSyncPlaying(false);
        if (deviceId) await spotifyPause(spotifyToken).catch(() => {});
        const t = track ? ` at ${fmtMs(progressMs)}` : "";
        showToast(`${partnerName ?? "Partner"} paused${t}`, "pause");
      }),

      socketService.on("sync-track", async (data) => {
        if (data?.roomId && data.roomId !== roomId) return;
        if (data?.uri && deviceId) {
          await spotifyPlay(spotifyToken, deviceId, { uris: [data.uri] }).catch(() => {});
        }
        if (data?.trackName) showToast(`Now: "${data.trackName}"`, "play");
      }),

      socketService.on("reaction", ({ emoji } = {}) => {
        if (emoji) addReaction(emoji, true);
      }),
    ];

    return () => {
      offs.forEach(fn => fn());
      clearTimeout(toastTimerRef.current);
      clearTimeout(celebTimerRef.current);
      clearInterval(listenRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, partnerName, track, progressMs, deviceId, spotifyToken]);

  // ── Handlers ───────────────────────────────────────────────
  const handlePlay = useCallback(async () => {
    if (connStatus !== "connected" || syncPlaying) return;
    lastPlayRef.current = Date.now();
    if (deviceId) await spotifyPlay(spotifyToken, deviceId).catch(() => {});
    socketService.emitPlay(roomId, { progressMs });
    setSyncPlaying(true);
  }, [connStatus, syncPlaying, deviceId, spotifyToken, roomId, progressMs]);

  const handlePause = useCallback(async () => {
    if (connStatus !== "connected" || !syncPlaying) return;
    if (deviceId) await spotifyPause(spotifyToken).catch(() => {});
    socketService.emitPause(roomId, { progressMs });
    setSyncPlaying(false);
  }, [connStatus, syncPlaying, deviceId, spotifyToken, roomId, progressMs]);

  const handleSkipNext = useCallback(async () => {
    if (!deviceId) return;
    await spotifySkipNext(spotifyToken).catch(() => {});
  }, [deviceId, spotifyToken]);

  const handleSkipPrev = useCallback(async () => {
    if (!deviceId) return;
    await spotifySkipPrev(spotifyToken).catch(() => {});
  }, [deviceId, spotifyToken]);

  const handleTrackPlay = useCallback((t) => {
    // Emit sync-track so partner also switches
    socketService.socket?.emit?.("sync-track", {
      roomId, uri: t.uri, trackName: t.name, timestamp: Date.now(),
    });
    setSyncPlaying(true);
    showToast(`Playing "${t.name}"`, "play");
  }, [roomId, showToast]);

  const handleReaction = useCallback((emoji) => {
    socketService.emitReaction(roomId, emoji);
    addReaction(emoji, false);
  }, [roomId, addReaction]);

  // ── Derived ────────────────────────────────────────────────
  const isConnected  = connStatus === "connected";
  const albumArt     = track?.album?.images?.[0]?.url ?? null;
  const trackName    = track?.name ?? (syncPlaying ? "Listening Together" : "Ready to Sync");
  const artistName   = track?.artists?.map(a => a.name).join(", ") ?? "Duo-fy Session";
  const progressPct  = durationMs > 0 ? Math.min((progressMs / durationMs) * 100, 100) : 0;
  const myInit       = profile?.name?.[0]?.toUpperCase() ?? "Y";
  const partInit     = (partnerName?.[0] ?? "P").toUpperCase();
  const listenMin    = Math.floor(listeningSecs / 60);
  const listenSec    = listeningSecs % 60;
  const showBanner   = !bannerDismissed && !playerReady;

  return (
    <div className={`room ${celebrating ? "room--celebrating" : ""}`}>

      {/* ── Ambient background ─────────────────────────── */}
      <div className="room__orb room__orb--a" />
      <div className="room__orb room__orb--b" />
      {celebrating && <div className="room__orb room__orb--c" />}
      {albumArt && (
        <div
          className="room__bg-art"
          style={{ backgroundImage: `url(${albumArt})` }}
          aria-hidden="true"
        />
      )}

      {/* ── Device banner ──────────────────────────────── */}
      {showBanner && (
        <DeviceBanner
          playerReady={playerReady}
          playerError={playerError}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* ── Floating reactions ──────────────────────────── */}
      <div className="room__reactions-stage" aria-hidden="true">
        {reactions.map(r => (
          <span
            key={r.id}
            className={`room__reaction ${r.fromPartner ? "room__reaction--partner" : ""}`}
          >{r.emoji}</span>
        ))}
      </div>

      {/* ── Toast ──────────────────────────────────────── */}
      {toast && (
        <div className={`room__toast room__toast--${toast.type}`} role="status" aria-live="polite">
          <span className="room__toast-dot" />
          {toast.text}
        </div>
      )}

      {/* ── Sync celebration ────────────────────────────── */}
      {celebrating && (
        <div className="room__celebrate" aria-hidden="true">
          <div className="room__celebrate-ring room__celebrate-ring--1" />
          <div className="room__celebrate-ring room__celebrate-ring--2" />
          <div className="room__celebrate-ring room__celebrate-ring--3" />
          <p className="room__celebrate-text">You're in sync ♥</p>
        </div>
      )}

      {/* ── Panels ──────────────────────────────────────── */}
      {showSearch && (
        <SearchPanel
          accessToken={spotifyToken}
          deviceId={deviceId}
          onClose={() => setShowSearch(false)}
          onTrackPlay={handleTrackPlay}
        />
      )}
      {showQueue && (
        <QueuePanel
          accessToken={spotifyToken}
          deviceId={deviceId}
          currentTrack={track}
          onClose={() => setShowQueue(false)}
        />
      )}

      {/* ════════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════════ */}
      <aside className="sidebar">
        <div className="sidebar__top">

          {/* Brand */}
          <a href="/" className="sidebar__brand">
            <img src="/duo-fy-icon.png" alt="" className="sidebar__logo" />
            <span className="sidebar__brand-name">Duo-fy</span>
          </a>

          {/* Search CTA */}
          <button className="sidebar__search-cta" onClick={() => setShowSearch(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <path d="M9.5 8.5a4 4 0 10-.93.93l2.75 2.75.94-.94L9.5 8.5zm-4 .5a3 3 0 110-6 3 3 0 010 6z"/>
            </svg>
            <span>Search songs…</span>
          </button>

          {/* Room code */}
          <div className="sidebar__section">
            <p className="sidebar__label">Room</p>
            <div className="sidebar__code-row">
              <code className="sidebar__code">{roomId}</code>
              <button
                className="sidebar__icon-btn"
                onClick={() => { navigator.clipboard?.writeText(roomId); showToast("Copied!", "info"); }}
                title="Copy code"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                  <path d="M3 1A1.5 1.5 0 001.5 2.5v5A1.5 1.5 0 003 9h4A1.5 1.5 0 008.5 7.5v-5A1.5 1.5 0 007 1H3zm0 1h4a.5.5 0 01.5.5v5A.5.5 0 017 8H3a.5.5 0 01-.5-.5v-5A.5.5 0 013 2z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Partner */}
          <div className="sidebar__section">
            <p className="sidebar__label">Partner</p>
            <div className="sidebar__partner">
              <div className={`sidebar__avatar ${partnerOnline ? "sidebar__avatar--on" : ""}`}>
                {partnerAvatar
                  ? <img src={partnerAvatar} alt={partnerName} />
                  : <span>{partnerOnline ? partInit : "?"}</span>
                }
                <span className={`sidebar__avatar-dot ${partnerOnline ? "sidebar__avatar-dot--on" : ""}`} />
              </div>
              <div className="sidebar__partner-text">
                <p className="sidebar__partner-name">
                  {partnerOnline ? (partnerName ?? "Partner") : "Waiting…"}
                </p>
                <p className="sidebar__partner-status">
                  {partnerOnline ? "● Connected" : "Share code to invite"}
                </p>
              </div>
            </div>
          </div>

          {/* Playback device */}
          <div className="sidebar__section">
            <p className="sidebar__label">Playback</p>
            <div className="sidebar__device">
              <span className={`sidebar__device-dot ${playerReady ? "sidebar__device-dot--on" : ""}`} />
              <span className="sidebar__device-text">
                {playerReady
                  ? "Browser player active"
                  : playerError?.includes("Premium")
                    ? "Needs Spotify Premium"
                    : "Connecting…"}
              </span>
            </div>
          </div>

          {/* Listening timer */}
          {listeningSecs > 0 && (
            <div className="sidebar__section">
              <p className="sidebar__label">Together for</p>
              <p className="sidebar__timer">
                {listenMin > 0 ? `${listenMin}m ` : ""}{listenSec}s
              </p>
            </div>
          )}
        </div>

        <div className="sidebar__bottom">
          <div className="sidebar__conn">
            <span className={`sidebar__conn-dot ${isConnected ? "sidebar__conn-dot--live" : ""}`} />
            <span className="sidebar__conn-label">
              {isConnected ? "Live" : connStatus === "reconnecting" ? "Reconnecting…" : "Offline"}
            </span>
            {latency !== null && <span className="sidebar__latency">{latency}ms</span>}
          </div>
          <button className="sidebar__leave" onClick={() => setShowSummary(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <path d="M8.5 2h-6v9h6v-2h1v2a1 1 0 01-1 1h-6a1 1 0 01-1-1V2a1 1 0 011-1h6a1 1 0 011 1v2h-1V2zm.9 2.4l2 2a.5.5 0 010 .7l-2 2-.7-.7L10 7.5H4.5a.5.5 0 010-1H10L8.7 5.1l.7-.7z"/>
            </svg>
            Leave Room
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════
          MAIN
      ════════════════════════════════════════════════════ */}
      <main className="room-main">

        {/* Avatar connector */}
        <div className="avatars">
          <div className="avatar-wrap">
            <div className={`avatar avatar--me ${syncPlaying ? "avatar--playing" : ""}`}>
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} /> : <span>{myInit}</span>}
            </div>
            <p className="avatar-name">{profile?.name ?? "You"}</p>
          </div>

          <div className={`connector ${partnerOnline ? "connector--on" : ""} ${syncPlaying ? "connector--beating" : ""}`}>
            <div className="connector__line" />
            <div className="connector__dot" />
            <div className="connector__line" />
          </div>

          <div className="avatar-wrap">
            <div className={`avatar ${partnerOnline ? "avatar--partner" : "avatar--offline"}`}>
              {partnerOnline
                ? (partnerAvatar ? <img src={partnerAvatar} alt={partnerName} /> : <span>{partInit}</span>)
                : <span className="avatar--ghost">?</span>
              }
              {partnerOnline && <span className="avatar__ring" />}
            </div>
            <p className="avatar-name">{partnerOnline ? (partnerName ?? "Partner") : "Waiting…"}</p>
          </div>
        </div>

        {/* ── PLAYER CARD ─────────────────────────────── */}
        <div className={`card ${syncPlaying ? "card--playing" : ""} ${celebrating ? "card--synced" : ""}`}>

          {/* Top strip: album art (square, left) + track info (right) */}
          <div className="card__top">
            <div className={`card__art-wrap ${syncPlaying ? "card__art-wrap--playing" : ""}`}>
              {albumArt
                ? <img src={albumArt} alt={trackName} className="card__art" />
                : <div className="card__art-placeholder"><PlaceholderArt /></div>
              }
              {syncPlaying && <div className="card__art-shine" />}
            </div>

            <div className="card__meta">
              <div className="card__badges">
                <span className={`card__badge ${syncPlaying ? "card__badge--synced" : ""}`}>
                  {syncPlaying ? "✓ Synced" : "○ Paused"}
                </span>
                {latency !== null && (
                  <span className={`card__badge card__badge--lat ${latency < 80 ? "card__badge--good" : latency < 200 ? "card__badge--ok" : "card__badge--slow"}`}>
                    {latency}ms
                  </span>
                )}
                {partnerOnline && syncPlaying && (
                  <span className="card__badge card__badge--ready">✓ Both</span>
                )}
              </div>
              <h2 className="card__track">{trackName}</h2>
              <p className="card__artist">{artistName}</p>

              {/* Waveform */}
              <div className="card__waveform" aria-hidden="true">
                {BARS.map((h, i) => (
                  <div
                    key={i}
                    className={`card__bar ${syncPlaying ? "card__bar--playing" : ""}`}
                    style={{
                      height:            syncPlaying ? `${h}px` : "3px",
                      animationDelay:    `${(i * 0.048).toFixed(2)}s`,
                      animationDuration: `${0.6 + (i % 6) * 0.11}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="card__progress-section">
            <div
              className="card__progress"
              role="progressbar"
              aria-valuenow={Math.round(progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="card__progress-fill" style={{ width: `${progressPct}%` }}>
                <div className="card__progress-thumb" />
              </div>
            </div>
            <div className="card__times">
              <span>{fmtMs(progressMs)}</span>
              <span>{fmtMs(durationMs)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="card__controls">
            <button
              className="card__ctrl-sm"
              onClick={handleSkipPrev}
              disabled={!deviceId}
              aria-label="Previous"
            ><PrevIcon /></button>

            <button
              className={`card__play ${syncPlaying ? "card__play--pause" : "card__play--play"} ${celebrating ? "card__play--synced" : ""}`}
              onClick={syncPlaying ? handlePause : handlePlay}
              disabled={!isConnected}
              aria-label={syncPlaying ? "Pause" : "Play"}
            >
              {syncPlaying ? <PauseIconLg /> : <PlayIconLg />}
              {celebrating && <div className="card__play-ring" />}
            </button>

            <button
              className="card__ctrl-sm"
              onClick={handleSkipNext}
              disabled={!deviceId}
              aria-label="Next"
            ><NextIcon /></button>
          </div>

          {/* Action row: search + queue + volume + reactions */}
          <div className="card__actions">
            <button
              className="card__action-btn"
              onClick={() => setShowSearch(true)}
            >
              <SearchIcon /> Search
            </button>
            <button
              className={`card__action-btn ${showQueue ? "card__action-btn--active" : ""}`}
              onClick={() => setShowQueue(q => !q)}
            >
              <QueueIcon /> Queue
            </button>

            <div className="card__volume">
              <VolumeIcon />
              <input
                type="range" min="0" max="1" step="0.02"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="card__volume-slider"
                aria-label="Volume"
              />
            </div>

            <div className="card__emoji-row">
              {REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  className="card__emoji"
                  onClick={() => handleReaction(emoji)}
                  aria-label={`React ${emoji}`}
                >{emoji}</button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ════════════════════════════════════════════════════
          BOTTOM BAR
      ════════════════════════════════════════════════════ */}
      <div className="bar">
        <div className="bar__left">
          {albumArt
            ? <img src={albumArt} alt="" className="bar__art" />
            : <div className="bar__art-placeholder"><MiniMusicIcon /></div>
          }
          <div className="bar__track-info">
            <p className="bar__track">{trackName}</p>
            <p className="bar__artist">{artistName}</p>
          </div>
        </div>

        <div className="bar__center">
          <button className="bar__ctrl" onClick={handleSkipPrev} disabled={!deviceId}><PrevIcon /></button>
          <button
            className={`bar__ctrl bar__ctrl--main ${syncPlaying ? "bar__ctrl--playing" : ""}`}
            onClick={syncPlaying ? handlePause : handlePlay}
            disabled={!isConnected}
          >
            {syncPlaying ? <PauseIconSm /> : <PlayIconSm />}
          </button>
          <button className="bar__ctrl" onClick={handleSkipNext} disabled={!deviceId}><NextIcon /></button>
        </div>

        <div className="bar__right">
          <button
            className="bar__icon-btn"
            onClick={() => setShowSearch(true)}
            title="Search"
          ><SearchIcon /></button>
          <button
            className={`bar__icon-btn ${showQueue ? "bar__icon-btn--active" : ""}`}
            onClick={() => setShowQueue(q => !q)}
            title="Queue"
          ><QueueIcon /></button>
          {listeningSecs > 60 && (
            <span className="bar__together">
              {listenMin}m{listenSec > 0 ? ` ${listenSec}s` : ""}
            </span>
          )}
          <div className={`bar__status ${syncPlaying ? "bar__status--live" : ""}`}>
            <span className="bar__status-dot" />
            {syncPlaying ? "Live" : "Ready"}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          SESSION SUMMARY MODAL
      ════════════════════════════════════════════════════ */}
      {showSummary && (
        <div
          className="summary-overlay"
          onClick={e => e.target === e.currentTarget && setShowSummary(false)}
        >
          <div className="summary">
            <div className="summary__icon">🎵</div>
            <h2 className="summary__title">Session Complete</h2>
            <p className="summary__sub">Here's how your listening went</p>

            <div className="summary__stats">
              <div className="summary__stat">
                <span className="summary__val">
                  {listenMin > 0 ? `${listenMin}m` : `${listeningSecs}s`}
                </span>
                <span className="summary__label">Together</span>
              </div>
              <div className="summary__stat">
                <span className="summary__val">{sessionSongs.size}</span>
                <span className="summary__label">Songs</span>
              </div>
              <div className="summary__stat">
                <span className="summary__val">{syncCount}</span>
                <span className="summary__label">Syncs</span>
              </div>
            </div>

            <p className="summary__msg">
              {listenMin >= 30
                ? "That's a full album's worth of togetherness ♥"
                : listenMin >= 10
                  ? "Great session — same songs, same moment ♥"
                  : listeningSecs > 0
                    ? "Every moment together counts ♥"
                    : "You're always welcome back ♥"}
            </p>

            <div className="summary__actions">
              <button
                className="summary__btn summary__btn--leave"
                onClick={() => { setShowSummary(false); onLeaveRoom(); }}
              >Leave Room</button>
              <button
                className="summary__btn summary__btn--stay"
                onClick={() => setShowSummary(false)}
              >Keep Listening</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
    <path d="M9.5 8.5a4 4 0 10-.93.93l2.75 2.75.94-.94L9.5 8.5zm-4 .5a3 3 0 110-6 3 3 0 010 6z"/>
  </svg>
);
const QueueIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M1 2.5h10M1 6h10M1 9.5h6M10 9l2 1.5L10 12"/>
  </svg>
);
const VolumeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
    <path d="M2.5 4.5H1v4h1.5L6 11V2L2.5 4.5zm5 1.5a2 2 0 010 1.5M9.5 3a5 5 0 010 7"/>
  </svg>
);
const PrevIcon   = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M3 3h1.5v9H3V3zm1.5 4.5L13 3v9L4.5 7.5z"/></svg>;
const NextIcon   = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M12 3h-1.5v9H12V3zM10.5 7.5L2 3v9l8.5-4.5z"/></svg>;
const PlayIconLg  = () => <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor"><path d="M6 3.5l18 10.5L6 24.5V3.5z"/></svg>;
const PauseIconLg = () => <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor"><rect x="4" y="3" width="8" height="22" rx="2"/><rect x="16" y="3" width="8" height="22" rx="2"/></svg>;
const PlayIconSm  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l9 5-9 5V2z"/></svg>;
const PauseIconSm = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="4" height="10" rx="1"/><rect x="8" y="2" width="4" height="10" rx="1"/></svg>;
const MiniMusicIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path d="M8 3v9.55A2.5 2.5 0 109 16V7h4V3H8z"/></svg>;

function PlaceholderArt() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" stroke="url(#pa1)" strokeWidth="1.5" strokeDasharray="5 4"/>
      <circle cx="28" cy="28" r="15" fill="url(#pa2)" opacity="0.5"/>
      <circle cx="28" cy="28" r="6" fill="white" opacity="0.85"/>
      <defs>
        <linearGradient id="pa1" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ff6eb4"/><stop offset="1" stopColor="#a855f7"/>
        </linearGradient>
        <linearGradient id="pa2" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#a855f7"/><stop offset="1" stopColor="#06b6d4"/>
        </linearGradient>
      </defs>
    </svg>
  );
}