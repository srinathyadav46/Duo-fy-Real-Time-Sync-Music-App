import "./PlayerControls.css";

const BAR_COUNT = 32;

const IDLE_HEIGHTS = Array.from({ length: BAR_COUNT }, () => 4);
const PLAYING_HEIGHTS = Array.from(
  { length: BAR_COUNT },
  (_, i) => 12 + Math.round(Math.sin(i * 0.65) * 10 + Math.cos(i * 0.35) * 8)
);

// ─── Waveform ───────────────────────────────────────────────────────────────

function Waveform({ isPlaying }) {
  return (
    <div
      className="flex items-center justify-center gap-[2.5px] h-14"
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const targetH = isPlaying ? PLAYING_HEIGHTS[i] : IDLE_HEIGHTS[i];

        return (
          <div
            key={i}
            className={`w-[3px] rounded-full transition-all ease-in-out ${
              isPlaying ? "bg-rose-400" : "bg-white/10"
            }`}
            style={{
              height: `${targetH}px`,
              transitionDuration: isPlaying
                ? `${0.3 + (i % 6) * 0.04}s`
                : "0.25s",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Latency Badge ──────────────────────────────────────────────────────────

function LatencyBadge({ ms }) {
  if (ms === null || ms === undefined) return null;

  const color =
    ms < 80
      ? "text-emerald-400"
      : ms < 200
      ? "text-yellow-400"
      : "text-rose-400";

  return (
    <span className={`text-[11px] font-mono ${color} opacity-60`}>
      {ms}ms
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PlayerControls({
  roomId,
  isPlaying,
  isConnected,
  latency,
  syncMsg,
  onPlay,
  onPause,
}) {
  return (
    <div
      className={`space-y-6 animate-fade-up transition-opacity duration-300 ${
        !isConnected ? "opacity-60 pointer-events-none" : ""
      }`}
      role="region"
      aria-label={`Playback controls for room ${roomId}`}
    >
      {/* Waveform */}
      <Waveform isPlaying={isPlaying} />

      {/* Status + latency */}
      <div className="flex items-center justify-between px-1">
        <span
          className={`text-xs font-medium uppercase tracking-widest ${
            isPlaying ? "text-rose-400" : "text-white/30"
          }`}
        >
          {isPlaying ? "● Playing" : "○ Paused"}
        </span>

        <LatencyBadge ms={latency} />
      </div>

      {/* Buttons */}
      <div className="relative">

        {/* Sync toast */}
        {syncMsg && (
          <div
            key={syncMsg}
            className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1.5 bg-rose-500/80 backdrop-blur-sm text-white text-xs font-medium rounded-full px-3.5 py-1.5 pointer-events-none animate-fade-in"
            role="status"
            aria-live="polite"
          >
            <span className="w-1.5 h-1.5 bg-white rounded-full opacity-80 shrink-0" />
            {syncMsg}
          </div>
        )}

        <div className="flex gap-3">

          <button
            onClick={onPlay}
            disabled={isPlaying || !isConnected}
            aria-label="Play"
            aria-pressed={isPlaying}
            className="
              flex-1 flex items-center justify-center gap-2
              py-3.5 rounded-2xl
              bg-rose-600/90 hover:bg-rose-500
              active:scale-[0.97]
              disabled:opacity-35 disabled:cursor-not-allowed
              text-white font-semibold tracking-wide
              transition-all duration-150
            "
          >
            <PlayIcon />
            Play
          </button>

          <button
            onClick={onPause}
            disabled={!isPlaying || !isConnected}
            aria-label="Pause"
            aria-pressed={!isPlaying}
            className="
              flex-1 flex items-center justify-center gap-2
              py-3.5 rounded-2xl
              border border-white/10
              hover:border-rose-400/30 hover:bg-rose-500/10
              active:scale-[0.97]
              disabled:opacity-35 disabled:cursor-not-allowed
              text-white/70 hover:text-white
              transition-all duration-150
            "
          >
            <PauseIcon />
            Pause
          </button>

        </div>
      </div>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <path d="M2 1.4L11.6 6.5 2 11.6V1.4Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <rect x="1.5" y="1.5" width="3.5" height="10" rx="1" />
      <rect x="8" y="1.5" width="3.5" height="10" rx="1" />
    </svg>
  );
}