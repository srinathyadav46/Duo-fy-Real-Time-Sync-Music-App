/**
 * useSpotifyPlayer.js
 *
 * Spotify Web Playback SDK integration.
 * Creates a real Duo-fy browser player and transfers playback to it.
 *
 * REQUIRES: Spotify Premium account.
 * Without Premium, Spotify silently rejects SDK initialization.
 *
 * Usage:
 *   const { deviceId, playerReady, playerError, volume, setVolume } =
 *     useSpotifyPlayer(accessToken);
 *
 * Once deviceId is available, use the Spotify REST API to transfer
 * playback to this device via PUT /v1/me/player.
 */

import { useEffect, useState, useRef, useCallback } from "react";

const SDK_SCRIPT_URL = "https://sdk.scdn.co/spotify-player.js";
const PLAYER_NAME    = "Duo-fy";

export function useSpotifyPlayer(accessToken) {
  const [deviceId,    setDeviceId]    = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(null); // string | null
  const [volume,      setVolumeState] = useState(0.7);

  const playerRef    = useRef(null);
  const tokenRef     = useRef(accessToken);

  // Keep token ref fresh for SDK callback (SDK holds a ref, not state)
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    // ── Load the SDK script once ──────────────────────────
    const scriptAlreadyLoaded = document.getElementById("spotify-sdk-script");

    const initPlayer = () => {
      if (playerRef.current) return; // already initialized

      const player = new window.Spotify.Player({
        name:          PLAYER_NAME,
        getOAuthToken: (cb) => cb(tokenRef.current),
        volume:        0.7,
      });

      playerRef.current = player;

      // ── Ready ────────────────────────────────────────────
      player.addListener("ready", ({ device_id }) => {
        console.log("[Duo-fy SDK] Player ready — device:", device_id);
        setDeviceId(device_id);
        setPlayerReady(true);
        setPlayerError(null);

        // Auto-transfer playback to browser player (don't auto-play)
        fetch("https://api.spotify.com/v1/me/player", {
          method:  "PUT",
          headers: {
            Authorization:  `Bearer ${tokenRef.current}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch(console.error);
      });

      // ── Not ready ─────────────────────────────────────────
      player.addListener("not_ready", ({ device_id }) => {
        console.warn("[Duo-fy SDK] Device went offline:", device_id);
        setPlayerReady(false);
      });

      // ── Errors ────────────────────────────────────────────
      player.addListener("initialization_error", ({ message }) => {
        console.error("[Duo-fy SDK] Init error:", message);
        setPlayerError("Player failed to initialize. Refresh and try again.");
      });

      player.addListener("authentication_error", ({ message }) => {
        console.error("[Duo-fy SDK] Auth error:", message);
        setPlayerError("Spotify authentication failed. Please log in again.");
      });

      player.addListener("account_error", ({ message }) => {
        console.error("[Duo-fy SDK] Account error:", message);
        setPlayerError("Spotify Premium is required to play music in the browser.");
      });

      player.addListener("playback_error", ({ message }) => {
        console.error("[Duo-fy SDK] Playback error:", message);
        // Don't block UI for playback errors — just log
      });

      player.connect();
    };

    if (window.Spotify) {
      // SDK already loaded (e.g. hot-reload)
      initPlayer();
    } else if (!scriptAlreadyLoaded) {
      // SDK callback — Spotify calls this when script is ready
      window.onSpotifyWebPlaybackSDKReady = initPlayer;

      const script    = document.createElement("script");
      script.id       = "spotify-sdk-script";
      script.src      = SDK_SCRIPT_URL;
      script.async    = true;
      document.head.appendChild(script);
    } else {
      // Script tag exists but SDK not ready yet — wait for callback
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
        setDeviceId(null);
        setPlayerReady(false);
      }
    };
  }, [accessToken]);

  const setVolume = useCallback((v) => {
    setVolumeState(v);
    playerRef.current?.setVolume(v).catch(console.error);
  }, []);

  return { deviceId, playerReady, playerError, volume, setVolume };
}


/**
 * Spotify REST helpers
 * All require an accessToken and (where noted) a deviceId.
 */

export async function spotifyPlay(accessToken, deviceId, options = {}) {
  /**
   * options:
   *   uris?         string[]   — specific track URIs to play
   *   context_uri?  string     — album/playlist URI
   *   offset?       object     — { uri } or { position }
   *   position_ms?  number
   */
  const body = {};
  if (options.uris)        body.uris         = options.uris;
  if (options.context_uri) body.context_uri  = options.context_uri;
  if (options.offset)      body.offset       = options.offset;
  if (options.position_ms) body.position_ms  = options.position_ms;

  return fetch(
    `https://api.spotify.com/v1/me/player/play${deviceId ? `?device_id=${deviceId}` : ""}`,
    {
      method:  "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    }
  );
}

export async function spotifyPause(accessToken) {
  return fetch("https://api.spotify.com/v1/me/player/pause", {
    method:  "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function spotifyAddToQueue(accessToken, trackUri) {
  return fetch(
    `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

export async function spotifySearch(accessToken, query, limit = 12) {
  if (!query.trim()) return [];
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.tracks?.items ?? [];
}

export async function spotifyGetQueue(accessToken) {
  const res = await fetch("https://api.spotify.com/v1/me/player/queue", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { currently_playing: null, queue: [] };
  return res.json();
}