/**
 * socket.js — Duo-fy Socket Service
 * Added: emitReaction, partner info on createRoom/joinRoom
 */

import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const IS_DEV = import.meta.env.DEV;

const socket = io(BACKEND_URL, {
  autoConnect:          false,
  transports:           ["websocket"],
  reconnection:         true,
  reconnectionAttempts: 5,
  reconnectionDelay:    1500,
  reconnectionDelayMax: 5000,
  timeout:              10000,
});

if (IS_DEV) {
  socket.onAny((event, ...args) =>
    console.log(`[Duo-fy ↓] "${event}"`, ...args)
  );
  socket.onAnyOutgoing((event, ...args) =>
    console.log(`[Duo-fy ↑] "${event}"`, ...args)
  );
  socket.on("connect",       () => console.log(`[Duo-fy] Connected — id: ${socket.id}`));
  socket.on("disconnect",    (r) => console.warn(`[Duo-fy] Disconnected — ${r}`));
  socket.on("connect_error", (e) => console.error(`[Duo-fy] Error — ${e.message}`));
}

const socketService = {
  // ── Lifecycle ──────────────────────────────────────────────
  connect()    { if (!socket.connected) socket.connect(); },
  disconnect() { socket.disconnect(); },
  get id()        { return socket.id; },
  get connected() { return socket.connected; },

  // ── Room ───────────────────────────────────────────────────
  // userInfo: { displayName, avatarUrl } — sent to partner on join
  createRoom(roomId, userInfo = {}) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Server did not respond in time.")), 8000);
      socket.emit("create-room", { roomId, ...userInfo }, (res) => {
        clearTimeout(t);
        res?.success ? resolve(res) : reject(new Error(res?.error || "Failed to create room."));
      });
    });
  },

  joinRoom(roomId, userInfo = {}) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Server did not respond in time.")), 8000);
      socket.emit("join-room", { roomId, ...userInfo }, (res) => {
        clearTimeout(t);
        res?.success ? resolve(res) : reject(new Error(res?.error || "Room not found."));
      });
    });
  },

  leaveRoom(roomId) { socket.emit("leave-room", { roomId }); },

  // ── Playback ───────────────────────────────────────────────
  emitPlay(roomId, meta = {}) {
    socket.emit("control", { event: "play", roomId, timestamp: Date.now(), ...meta });
  },

  emitPause(roomId, meta = {}) {
    socket.emit("control", { event: "pause", roomId, timestamp: Date.now(), ...meta });
  },

  // ── Reactions ─────────────────────────────────────────────
  emitReaction(roomId, emoji) {
    socket.emit("reaction", { roomId, emoji, timestamp: Date.now() });
  },

  // ── Listeners ─────────────────────────────────────────────
  on(event, handler) {
    socket.on(event, handler);
    return () => socket.off(event, handler);
  },
  off(event, handler) { socket.off(event, handler); },
  once(event, handler) { socket.once(event, handler); },
};

export default socketService;