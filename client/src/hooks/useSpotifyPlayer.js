/**
 * src/hooks/useSpotifyPlayer.js
 *
 * Spotify Web Playback SDK — creates a real browser audio player.
 * Requires Spotify Premium. Without it, playerError is set to a clear message.
 *
 * Exports:
 *   useSpotifyPlayer(accessToken) → { deviceId, playerReady, playerError, volume, setVolume }
 *   spotifyPlay(accessToken, deviceId?, options?)
 *   spotifyPause(accessToken)
 *   spotifyAddToQueue(accessToken, trackUri)
 *   spotifySearch(accessToken, query, limit?)
 *   spotifyGetQueue(accessToken)
 */

import { useEffect, useState, useRef, useCallback } from "react";

const SDK_URL     = "https://sdk.scdn.co/spotify-player.js";
const PLAYER_NAME = "Duo-fy";

export function useSpotifyPlayer(accessToken) {
  const [deviceId,    setDeviceId]    = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [volume,      setVolumeState] = useState(0.7);

  const playerRef = useRef(null);
  const tokenRef  = useRef(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    const init = () => {
      if (playerRef.current) return;

      const player = new window.Spotify.Player({
        name:          PLAYER_NAME,
        getOAuthToken: cb => cb(tokenRef.current),
        volume:        0.7,
      });

      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setPlayerReady(true);
        setPlayerError(null);
        // Transfer playback to browser (don't auto-start)
        fetch("https://api.spotify.com/v1/me/player", {
          method:  "PUT",
          headers: { Authorization: `Bearer ${tokenRef.current}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch(() => {});
      });

      player.addListener("not_ready",            ()  => { setPlayerReady(false); setDeviceId(null); });
      player.addListener("initialization_error", ()  => setPlayerError("Player failed to initialize. Try refreshing."));
      player.addListener("authentication_error", ()  => setPlayerError("Spotify authentication failed. Please log in again."));
      player.addListener("account_error",        ()  => setPlayerError("Spotify Premium is required to play audio in the browser."));
      player.addListener("playback_error",       ({ message }) => console.warn("[SDK] Playback error:", message));

      player.connect();
    };

    if (window.Spotify) {
      init();
    } else if (!document.getElementById("spotify-sdk")) {
      window.onSpotifyWebPlaybackSDKReady = init;
      const s  = document.createElement("script");
      s.id     = "spotify-sdk";
      s.src    = SDK_URL;
      s.async  = true;
      document.head.appendChild(s);
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setDeviceId(null);
      setPlayerReady(false);
    };
  }, [accessToken]);

  const setVolume = useCallback(v => {
    setVolumeState(v);
    playerRef.current?.setVolume(v).catch(() => {});
  }, []);

  return { deviceId, playerReady, playerError, volume, setVolume };
}

// ── REST helpers ──────────────────────────────────────────────

export async function spotifyPlay(accessToken, deviceId, options = {}) {
  const body = {};
  if (options.uris)        body.uris        = options.uris;
  if (options.context_uri) body.context_uri = options.context_uri;
  if (options.offset)      body.offset      = options.offset;
  if (options.position_ms !== undefined) body.position_ms = options.position_ms;

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
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export async function spotifySearch(accessToken, query, limit = 15) {
  if (!query?.trim()) return [];
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  return (await res.json()).tracks?.items ?? [];
}

export async function spotifyGetQueue(accessToken) {
  const res = await fetch("https://api.spotify.com/v1/me/player/queue", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { currently_playing: null, queue: [] };
  return res.json();
}

export async function spotifySkipNext(accessToken) {
  return fetch("https://api.spotify.com/v1/me/player/next", {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function spotifySkipPrev(accessToken) {
  return fetch("https://api.spotify.com/v1/me/player/previous", {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}