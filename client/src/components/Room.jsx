import { useState, useEffect, useCallback, useRef } from "react";
import socketService from "../socket";
import { useSpotify, fmtMs } from "../hooks/useSpotify";
import {
  useSpotifyPlayer, spotifyPlay, spotifyPause,
  spotifySkipNext, spotifySkipPrev,
} from "../hooks/useSpotifyPlayer";
import SearchPanel  from "./SearchPanel";
import QueuePanel   from "./QueuePanel";
import DeviceBanner from "./DeviceBanner";
import "./Room.css";

const REACTIONS = ["❤️", "🔥", "🌙", "✨", "🎵"];
const BARS = Array.from({ length: 32 }, (_, i) =>
  8 + Math.round(Math.abs(Math.sin(i * 0.65 + 0.2)) * 18 + Math.cos(i * 0.4) * 7)
);

// Human-readable latency label
function syncLabel(ms) {
  if (ms === null) return null;
  if (ms < 60)  return { text: "Perfect Sync ✦", cls: "sync--perfect" };
  if (ms < 150) return { text: "In Sync ✓",      cls: "sync--good"    };
  if (ms < 350) return { text: "Adjusting…",      cls: "sync--ok"     };
  return               { text: "Syncing…",         cls: "sync--slow"   };
}

// Partner activity label
function partnerStatusLabel(online, playing, lastAction) {
  if (!online) return { text: "Waiting for partner", dot: "dot--off" };
  if (playing) return { text: "Listening ♪",          dot: "dot--playing" };
  return               { text: "Connected",            dot: "dot--on"  };
}

// Share via Web Share API or fallback copy
async function shareRoom(roomId) {
  const url  = `${window.location.origin}/room/${roomId}`;
  const data = { title: "Join my Duo-fy room 🎵", text: `Listen together on Duo-fy`, url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch { /* cancelled */ }
  }
  await navigator.clipboard.writeText(url).catch(() => {});
}

export default function Room({ roomId, onLeaveRoom, spotifyToken }) {
  // ── Spotify ───────────────────────────────────────────────
  const { track, progressMs, durationMs, isPlaying: _sp, profile } =
    useSpotify(spotifyToken);
  const { deviceId, playerReady, playerError, volume, setVolume } =
    useSpotifyPlayer(spotifyToken);

  // ── Sync ──────────────────────────────────────────────────
  const [syncPlaying, setSyncPlaying] = useState(false);
  const [connStatus,  setConnStatus]  = useState("connecting");
  const [latency,     setLatency]     = useState(null);

  // ── Partner ────────────────────────────────────────────────
  const [partnerOnline,  setPartnerOnline]  = useState(false);
  const [partnerName,    setPartnerName]    = useState(null);
  const [partnerAvatar,  setPartnerAvatar]  = useState(null);
  const [partnerPlaying, setPartnerPlaying] = useState(false);

  // ── Panels / UI ────────────────────────────────────────────
  const [showSearch,      setShowSearch]      = useState(false);
  const [showQueue,       setShowQueue]       = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showSummary,     setShowSummary]     = useState(false);
  const [codeCopied,      setCodeCopied]      = useState(false);
  const [linkCopied,      setLinkCopied]      = useState(false);
  const [showRoomCard,    setShowRoomCard]    = useState(true);

  // ── Toast / reactions / celebration ────────────────────────
  const [toast,       setToast]       = useState(null);
  const [reactions,   setReactions]   = useState([]);
  const [celebrating, setCelebrating] = useState(false);
  const [heartbeat,   setHeartbeat]   = useState(false); // both-playing pulse

  // ── Session ────────────────────────────────────────────────
  const [listeningSecs, setListeningSecs] = useState(0);
  const [sessionSongs,  setSessionSongs]  = useState(new Set());
  const [syncCount,     setSyncCount]     = useState(0);

  const toastRef    = useRef(null);
  const celebRef    = useRef(null);
  const listenRef   = useRef(null);
  const lastPlayRef = useRef(null);
  const prevTrkRef  = useRef(null);

  // Session song tracking
  useEffect(() => {
    if (track?.id && track.id !== prevTrkRef.current) {
      prevTrkRef.current = track.id;
      setSessionSongs(p => new Set([...p, track.id]));
    }
  }, [track?.id]);

  // Listening timer
  useEffect(() => {
    if (syncPlaying && partnerOnline) {
      listenRef.current = setInterval(() => setListeningSecs(s => s + 1), 1000);
      setHeartbeat(true);
    } else {
      clearInterval(listenRef.current);
      setHeartbeat(false);
    }
    return () => clearInterval(listenRef.current);
  }, [syncPlaying, partnerOnline]);

  const showToast = useCallback((text, type = "info") => {
    clearTimeout(toastRef.current);
    setToast({ text, type });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const celebrate = useCallback(() => {
    setCelebrating(true);
    clearTimeout(celebRef.current);
    celebRef.current = setTimeout(() => setCelebrating(false), 3000);
  }, []);

  const addReaction = useCallback((emoji, fromPartner) => {
    const id = Date.now() + Math.random();
    setReactions(p => [...p, { id, emoji, fromPartner }]);
    setTimeout(() => setReactions(p => p.filter(r => r.id !== id)), 2800);
  }, []);

  // ── Copy helpers ───────────────────────────────────────────
  const copyCode = async () => {
    await navigator.clipboard?.writeText(roomId).catch(() => {});
    setCodeCopied(true);
    showToast("Room code copied!", "info");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    setLinkCopied(true);
    showToast("Room link copied!", "info");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShare = async () => {
    await shareRoom(roomId);
  };

  // ── Socket ─────────────────────────────────────────────────
  useEffect(() => {
    if (socketService.connected) setConnStatus("connected");

    const offs = [
      socketService.on("connect",           () => setConnStatus("connected")),
      socketService.on("disconnect",        r  => {
        if (r !== "io client disconnect") { setConnStatus("disconnected"); setSyncPlaying(false); }
      }),
      socketService.on("reconnect_attempt", () => setConnStatus("reconnecting")),

      socketService.on("partner-joined", data => {
        setPartnerOnline(true);
        setPartnerName(data?.displayName ?? "Partner");
        setPartnerAvatar(data?.avatarUrl  ?? null);
        setShowRoomCard(false); // hide room card once partner joins
        showToast(`${data?.displayName ?? "Partner"} joined 🎵`, "join");
      }),

      socketService.on("partner-left", () => {
        setPartnerOnline(false);
        setPartnerPlaying(false);
        setShowRoomCard(true);
        setSyncPlaying(false);
        showToast(`${partnerName ?? "Partner"} left`, "leave");
      }),

      socketService.on("sync-play", async data => {
        if (data?.roomId && data.roomId !== roomId) return;
        const lag = data?.timestamp ? Date.now() - data.timestamp : null;
        if (lag !== null) setLatency(lag);
        setSyncPlaying(true);
        setPartnerPlaying(true);
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

      socketService.on("sync-pause", async data => {
        if (data?.roomId && data.roomId !== roomId) return;
        const lag = data?.timestamp ? Date.now() - data.timestamp : null;
        if (lag !== null) setLatency(lag);
        setSyncPlaying(false);
        setPartnerPlaying(false);
        if (deviceId) await spotifyPause(spotifyToken).catch(() => {});
        const t = track ? ` at ${fmtMs(progressMs)}` : "";
        showToast(`${partnerName ?? "Partner"} paused${t}`, "pause");
      }),

      socketService.on("sync-track", async data => {
        if (data?.roomId && data.roomId !== roomId) return;
        if (data?.uri && deviceId)
          await spotifyPlay(spotifyToken, deviceId, { uris: [data.uri] }).catch(() => {});
        if (data?.trackName) showToast(`Now: "${data.trackName}"`, "play");
      }),

      socketService.on("reaction", ({ emoji } = {}) => {
        if (emoji) addReaction(emoji, true);
      }),
    ];

    return () => {
      offs.forEach(fn => fn());
      clearTimeout(toastRef.current);
      clearTimeout(celebRef.current);
      clearInterval(listenRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, partnerName, track, progressMs, deviceId, spotifyToken]);

  // ── Playback ────────────────────────────────────────────────
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
    if (deviceId) await spotifySkipNext(spotifyToken).catch(() => {});
  }, [deviceId, spotifyToken]);

  const handleSkipPrev = useCallback(async () => {
    if (deviceId) await spotifySkipPrev(spotifyToken).catch(() => {});
  }, [deviceId, spotifyToken]);

  const handleTrackPlay = useCallback(t => {
    socketService.socket?.emit?.("sync-track", {
      roomId, uri: t.uri, trackName: t.name, timestamp: Date.now(),
    });
    setSyncPlaying(true);
    showToast(`Playing "${t.name}"`, "play");
  }, [roomId, showToast]);

  const handleReaction = useCallback(emoji => {
    socketService.emitReaction(roomId, emoji);
    addReaction(emoji, false);
  }, [roomId, addReaction]);

  // ── Derived ────────────────────────────────────────────────
  const isConnected  = connStatus === "connected";
  const albumArt     = track?.album?.images?.[0]?.url ?? null;
  const trackName    = track?.name ?? "Ready to Sync";
  const artistName   = track?.artists?.map(a => a.name).join(", ") ?? "Open Spotify to start";
  const progressPct  = durationMs > 0 ? Math.min((progressMs / durationMs) * 100, 100) : 0;
  const myInit       = profile?.name?.[0]?.toUpperCase() ?? "Y";
  const partInit     = (partnerName?.[0] ?? "P").toUpperCase();
  const listenMin    = Math.floor(listeningSecs / 60);
  const listenSec    = listeningSecs % 60;
  const showBanner   = !bannerDismissed && !playerReady;
  const sync         = syncLabel(latency);
  const partStatus   = partnerStatusLabel(partnerOnline, partnerPlaying);
  const canShare     = !!navigator.share || !!navigator.clipboard;

  return (
    <div className={`room ${celebrating ? "room--celebrating" : ""} ${heartbeat ? "room--heartbeat" : ""}`}>

      {/* ── Ambient bg ──────────────────────────────────── */}
      <div className="room-orb room-orb--a" />
      <div className="room-orb room-orb--b" />
      {celebrating && <div className="room-orb room-orb--celebrate" />}
      {albumArt && (
        <div className="room-art-bg" style={{ backgroundImage: `url(${albumArt})` }} aria-hidden />
      )}

      {/* ── Device banner ────────────────────────────────── */}
      {showBanner && (
        <DeviceBanner
          playerReady={playerReady}
          playerError={playerError}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* ── Floating reactions ────────────────────────────── */}
      <div className="reactions-stage" aria-hidden>
        {reactions.map(r => (
          <span key={r.id} className={`r-float ${r.fromPartner ? "r-float--partner" : ""}`}>
            {r.emoji}
          </span>
        ))}
      </div>

      {/* ── Toast ────────────────────────────────────────── */}
      {toast && (
        <div className={`toast toast--${toast.type}`} role="status" aria-live="polite">
          <span className="toast-dot" />{toast.text}
        </div>
      )}

      {/* ── Sync celebration ──────────────────────────────── */}
      {celebrating && (
        <div className="celebrate" aria-hidden>
          <div className="celebrate-ring celebrate-ring--1" />
          <div className="celebrate-ring celebrate-ring--2" />
          <div className="celebrate-ring celebrate-ring--3" />
          <p className="celebrate-text">You're in sync ♥</p>
        </div>
      )}

      {/* ── Panels ────────────────────────────────────────── */}
      {showSearch && (
        <SearchPanel
          accessToken={spotifyToken} deviceId={deviceId}
          onClose={() => setShowSearch(false)} onTrackPlay={handleTrackPlay}
        />
      )}
      {showQueue && (
        <QueuePanel
          accessToken={spotifyToken} deviceId={deviceId}
          currentTrack={track} onClose={() => setShowQueue(false)}
        />
      )}

      {/* ════════════════════════════════════════════
          TOP NAV BAR
      ════════════════════════════════════════════ */}
      <header className="topbar">
        <a href="/" className="topbar-brand">
          <img src="/duo-fy-icon.png" alt="" className="topbar-logo" />
          <span className="topbar-name">Duo-<span>fy</span></span>
        </a>

        <div className="topbar-right">
          {/* Latency chip */}
          {sync && (
            <span className={`sync-chip ${sync.cls}`}>{sync.text}</span>
          )}
          {/* Connection dot */}
          <div className={`conn-dot ${isConnected ? "conn-dot--live" : ""}`} title={connStatus} />
        </div>
      </header>

      {/* ════════════════════════════════════════════
          MAIN SCROLL CONTENT
      ════════════════════════════════════════════ */}
      <main className="room-scroll">

        {/* ── Room code card (always visible until partner joins) ── */}
        {showRoomCard && (
          <div className="room-code-card">
            <p className="room-code-label">Share this room code</p>
            <div className="room-code-big">{roomId}</div>
            <p className="room-code-hint">Send this to the person you want to listen with</p>
            <div className="room-code-actions">
              <button className="code-btn code-btn--primary" onClick={copyCode}>
                {codeCopied ? "✓ Copied" : <><CopyIcon /> Copy Code</>}
              </button>
              <button className="code-btn code-btn--secondary" onClick={copyLink}>
                {linkCopied ? "✓ Link Copied" : <><LinkIcon /> Copy Link</>}
              </button>
              {canShare && (
                <button className="code-btn code-btn--share" onClick={handleShare}>
                  <ShareIcon /> Share
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Partner status bar ─────────────────────────────── */}
        <div className="partner-bar">
          <div className="partner-bar__me">
            <div className={`p-avatar p-avatar--me ${syncPlaying ? "p-avatar--playing" : ""}`}>
              {profile?.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.name} />
                : <span>{myInit}</span>
              }
              {heartbeat && <span className="p-avatar__beat" />}
            </div>
            <span className="p-name">{profile?.name ?? "You"}</span>
          </div>

          <div className={`p-connector ${partnerOnline && syncPlaying ? "p-connector--sync" : partnerOnline ? "p-connector--on" : ""}`}>
            <div className="p-connector__line" />
            <div className="p-connector__heart">♥</div>
            <div className="p-connector__line" />
          </div>

          <div className="partner-bar__them">
            <div className={`p-avatar ${partnerOnline ? "p-avatar--partner" : "p-avatar--waiting"}`}>
              {partnerOnline
                ? (partnerAvatar ? <img src={partnerAvatar} alt={partnerName} /> : <span>{partInit}</span>)
                : <span className="p-avatar__ghost">?</span>
              }
              {partnerOnline && <span className={`p-avatar__status-dot ${partnerPlaying ? "p-avatar__status-dot--playing" : ""}`} />}
            </div>
            <span className="p-name">{partnerOnline ? (partnerName ?? "Partner") : "Waiting…"}</span>
          </div>
        </div>

        {/* ── Partner status pill ────────────────────────────── */}
        <div className={`partner-status-pill ${partStatus.dot}`}>
          <span className={`psp-dot ${partStatus.dot}`} />
          {partStatus.text}
        </div>

        {/* ── PLAYER CARD ────────────────────────────────────── */}
        <div className={`player-card ${syncPlaying ? "player-card--playing" : ""} ${celebrating ? "player-card--synced" : ""}`}>

          {/* Album art — full width, prominent */}
          <div className={`art-container ${syncPlaying ? "art-container--playing" : ""}`}>
            {albumArt ? (
              <img src={albumArt} alt={trackName} className="art-img" />
            ) : (
              <div className="art-placeholder">
                <PlaceholderArt />
                {!track && (
                  <p className="art-placeholder__hint">
                    Open Spotify on any device to load a song
                  </p>
                )}
              </div>
            )}
            {syncPlaying && <div className="art-glow" />}
          </div>

          {/* Track info */}
          <div className="track-info">
            <div className="track-badges">
              <span className={`track-badge ${syncPlaying ? "track-badge--playing" : ""}`}>
                {syncPlaying ? "● Playing" : "○ Paused"}
              </span>
              {listeningSecs > 0 && (
                <span className="track-badge track-badge--time">
                  ♥ {listenMin > 0 ? `${listenMin}m ` : ""}{listenSec}s together
                </span>
              )}
            </div>
            <h2 className="track-name">{trackName}</h2>
            <p className="track-artist">{artistName}</p>

            {/* Waveform */}
            <div className="waveform" aria-hidden>
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className={`w-bar ${syncPlaying ? "w-bar--active" : ""}`}
                  style={{
                    height:            syncPlaying ? `${h}px` : "3px",
                    animationDelay:    `${(i * 0.052).toFixed(2)}s`,
                    animationDuration: `${0.6 + (i % 5) * 0.12}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="progress-wrap">
            <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progressPct)}>
              <div className="progress-fill" style={{ width: `${progressPct}%` }}>
                <div className="progress-thumb" />
              </div>
            </div>
            <div className="progress-times">
              <span>{fmtMs(progressMs)}</span>
              <span>{fmtMs(durationMs)}</span>
            </div>
          </div>

          {/* Controls — large, thumb-friendly */}
          <div className="controls">
            <button
              className="ctrl ctrl--sm"
              onClick={handleSkipPrev}
              disabled={!deviceId}
              aria-label="Previous"
            ><PrevIcon /></button>

            <button
              className={`ctrl ctrl--play ${syncPlaying ? "ctrl--pause" : ""} ${celebrating ? "ctrl--celebrating" : ""}`}
              onClick={syncPlaying ? handlePause : handlePlay}
              disabled={!isConnected}
              aria-label={syncPlaying ? "Pause" : "Play"}
            >
              {syncPlaying ? <PauseIconLg /> : <PlayIconLg />}
              {celebrating && <div className="ctrl--play-ring" />}
            </button>

            <button
              className="ctrl ctrl--sm"
              onClick={handleSkipNext}
              disabled={!deviceId}
              aria-label="Next"
            ><NextIcon /></button>
          </div>

          {/* Volume (mobile-friendly range) */}
          <div className="volume-row">
            <VolumeMin />
            <input
              type="range" min="0" max="1" step="0.02"
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="volume-slider"
              aria-label="Volume"
            />
            <VolumeMax />
          </div>

          {/* Action row */}
          <div className="action-row">
            <button className="action-btn" onClick={() => setShowSearch(true)}>
              <SearchIconSm /> Search
            </button>
            <button className={`action-btn ${showQueue ? "action-btn--on" : ""}`} onClick={() => setShowQueue(q => !q)}>
              <QueueIconSm /> Queue
            </button>
            <div className="emoji-row">
              {REACTIONS.map(e => (
                <button key={e} className="emoji-btn" onClick={() => handleReaction(e)} aria-label={`React ${e}`}>{e}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Room code (compact, always accessible) ── */}
        {!showRoomCard && (
          <div className="room-code-compact">
            <span className="rcc-label">Room</span>
            <code className="rcc-code">{roomId}</code>
            <button className="rcc-btn" onClick={copyCode} title="Copy code">
              {codeCopied ? "✓" : <CopyIcon />}
            </button>
            <button className="rcc-btn" onClick={handleShare} title="Share">
              <ShareIcon />
            </button>
          </div>
        )}

        {/* ── Leave button ───────────────────────────────────── */}
        <button className="leave-btn" onClick={() => setShowSummary(true)}>
          Leave Room
        </button>

        {/* Bottom padding for bar */}
        <div style={{ height: "16px" }} />
      </main>

      {/* ════════════════════════════════════════════
          BOTTOM BAR (sticky mini-player)
      ════════════════════════════════════════════ */}
      <div className="mini-bar">
        <div className="mini-bar__track">
          {albumArt
            ? <img src={albumArt} alt="" className="mini-bar__art" />
            : <div className="mini-bar__art-ph"><MusicIcon /></div>
          }
          <div className="mini-bar__info">
            <p className="mini-bar__name">{trackName}</p>
            <p className="mini-bar__artist">{artistName}</p>
          </div>
        </div>

        <div className="mini-bar__controls">
          <button className="mini-ctrl" onClick={handleSkipPrev} disabled={!deviceId}><PrevIconSm /></button>
          <button
            className={`mini-ctrl mini-ctrl--play ${syncPlaying ? "mini-ctrl--pause" : ""}`}
            onClick={syncPlaying ? handlePause : handlePlay}
            disabled={!isConnected}
          >
            {syncPlaying ? <PauseIconSm /> : <PlayIconSm />}
          </button>
          <button className="mini-ctrl" onClick={handleSkipNext} disabled={!deviceId}><NextIconSm /></button>
        </div>

        <div className="mini-bar__right">
          <button className="mini-icon-btn" onClick={() => setShowSearch(true)}><SearchIconSm /></button>
          <button className={`mini-icon-btn ${showQueue ? "mini-icon-btn--on" : ""}`} onClick={() => setShowQueue(q => !q)}><QueueIconSm /></button>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          SESSION SUMMARY MODAL
      ════════════════════════════════════════════ */}
      {showSummary && (
        <div className="summary-overlay" onClick={e => e.target === e.currentTarget && setShowSummary(false)}>
          <div className="summary-card">
            <div className="summary-icon">🎵</div>
            <h2 className="summary-title">Session Complete</h2>
            <p className="summary-sub">Here's how your listening went</p>

            <div className="summary-stats">
              <div className="summary-stat">
                <span className="ss-val">{listenMin > 0 ? `${listenMin}m` : `${listeningSecs}s`}</span>
                <span className="ss-label">Together</span>
              </div>
              <div className="summary-stat">
                <span className="ss-val">{sessionSongs.size}</span>
                <span className="ss-label">Songs</span>
              </div>
              <div className="summary-stat">
                <span className="ss-val">{syncCount}</span>
                <span className="ss-label">Syncs</span>
              </div>
            </div>

            <p className="summary-msg">
              {listenMin >= 30 ? "That's a full album's worth of togetherness ♥"
                : listenMin >= 10 ? "Same songs, same moment ♥"
                : listeningSecs > 0 ? "Every moment together counts ♥"
                : "You're always welcome back ♥"}
            </p>

            <button
              className="summary-leave-btn"
              onClick={() => { setShowSummary(false); onLeaveRoom(); }}
            >Leave Room</button>
            <button
              className="summary-stay-btn"
              onClick={() => setShowSummary(false)}
            >Keep Listening</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────── */
const CopyIcon     = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M4 1A1.5 1.5 0 002.5 2.5v6A1.5 1.5 0 004 10h5A1.5 1.5 0 0010.5 8.5v-6A1.5 1.5 0 009 1H4zm0 1h5a.5.5 0 01.5.5v6a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5v-6A.5.5 0 014 2z"/></svg>;
const LinkIcon     = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M6.5 2a1 1 0 00-.7.3L4.3 3.8a3 3 0 000 4.2l.7-.7a2 2 0 010-2.8l1.5-1.5A2 2 0 019.3 5.8l-.7.7a3 3 0 000-4.2A1 1 0 006.5 2zm0 9a1 1 0 00.7-.3l1.5-1.5a3 3 0 000-4.2l-.7.7a2 2 0 010 2.8l-1.5 1.5A2 2 0 013.7 7.2l.7-.7a3 3 0 000 4.2A1 1 0 006.5 11z"/></svg>;
const ShareIcon    = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M9.5 1a2 2 0 100 4 2 2 0 000-4zm-6 2.5a2 2 0 100 4 2 2 0 000-4zm6 4a2 2 0 100 4 2 2 0 000-4zM9.5 3a1 1 0 110 2 1 1 0 010-2zm-6 2.5a1 1 0 110 2 1 1 0 010-2zm6 4a1 1 0 110 2 1 1 0 010-2zM3.72 6.38l5.06 2.24-.38.86L3.34 7.24l.38-.86zm5.06-2.62L3.72 6.12l-.38-.86 5.06-2.38.38.86z"/></svg>;
const SearchIconSm = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><path d="M9.5 8.5a4 4 0 10-.93.93l2.75 2.75.94-.94L9.5 8.5zm-4 .5a3 3 0 110-6 3 3 0 010 6z"/></svg>;
const QueueIconSm  = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 2.5h10M1 6h10M1 9.5h6M10 9l2 1.5L10 12"/></svg>;
const MusicIcon    = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2v9.55A2.5 2.5 0 109 15V6h4V2H8z"/></svg>;
const VolumeMin    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 5H0v4h2l4 4V1L2 5z"/></svg>;
const VolumeMax    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 5H0v4h2l4 4V1L2 5zm6 .5a2.5 2.5 0 010 3M10 3a5 5 0 010 8"/></svg>;
const PrevIcon     = () => <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><path d="M4 4h2.5v14H4V4zm2.5 7L18 4v14L6.5 11z"/></svg>;
const NextIcon     = () => <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><path d="M18 4h-2.5v14H18V4zM15.5 11L4 4v14l11.5-7z"/></svg>;
const PlayIconLg   = () => <svg width="34" height="34" viewBox="0 0 34 34" fill="currentColor"><path d="M7 4l22 13L7 30V4z"/></svg>;
const PauseIconLg  = () => <svg width="34" height="34" viewBox="0 0 34 34" fill="currentColor"><rect x="5" y="4" width="9" height="26" rx="2"/><rect x="20" y="4" width="9" height="26" rx="2"/></svg>;
const PrevIconSm   = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M3 3h1.5v9H3V3zm1.5 4.5L12 3v9L4.5 7.5z"/></svg>;
const NextIconSm   = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M12 3h-1.5v9H12V3zM10.5 7.5L3 3v9l7.5-4.5z"/></svg>;
const PlayIconSm   = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M3 2l10 5.5L3 13V2z"/></svg>;
const PauseIconSm  = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="2" y="2" width="4" height="11" rx="1"/><rect x="9" y="2" width="4" height="11" rx="1"/></svg>;

function PlaceholderArt() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="36" r="34" stroke="url(#pa1)" strokeWidth="1.5" strokeDasharray="5 4"/>
      <circle cx="36" cy="36" r="20" fill="url(#pa2)" opacity="0.4"/>
      <circle cx="36" cy="36" r="8" fill="white" opacity="0.8"/>
      <defs>
        <linearGradient id="pa1" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff6eb4"/><stop offset="1" stopColor="#a855f7"/></linearGradient>
        <linearGradient id="pa2" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a855f7"/><stop offset="1" stopColor="#22d3ee"/></linearGradient>
      </defs>
    </svg>
  );
}
