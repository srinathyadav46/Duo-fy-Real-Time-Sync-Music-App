/**
 * server.js — Duo-fy Backend
 *
 * Upgrades over v1:
 * - Environment validation on startup (fail fast)
 * - CORS driven by env variable (no hardcoded origins)
 * - Room size limit (max 2 players per room)
 * - join-room rejects if room is full
 * - control events validated before broadcast
 * - Graceful shutdown (SIGTERM / SIGINT)
 * - Centralized error logging helper
 * - HTTP health check endpoint
 * - Tokens never logged
 */

import express  from "express";
import http     from "http";
import { Server } from "socket.io";
import cors     from "cors";
import dotenv   from "dotenv";
import axios    from "axios";

dotenv.config();

// ─── Environment Validation ───────────────────────────────────────────────────

const REQUIRED_ENV = [
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_REDIRECT_URI",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[Duo-fy] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  FRONTEND_URL = "http://127.0.0.1:5173",
  PORT         = 5000,
  NODE_ENV     = "development",
} = process.env;

const IS_DEV = NODE_ENV !== "production";

// ─── App + Server ─────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────

const io = new Server(server, {
  cors: {
    origin:  FRONTEND_URL,
    methods: ["GET", "POST"],
  },
  // Force WebSocket transport to match client config
  transports: ["websocket","polling"],
  // Disconnect ghost clients faster
  pingTimeout:  20000,
  pingInterval: 10000,
});

// ─── Express Middleware ───────────────────────────────────────────────────────

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(level, ...args) {
  const prefix = `[Duo-fy ${new Date().toISOString()}]`;
  if (level === "error") console.error(prefix, ...args);
  else if (IS_DEV)       console.log(prefix, ...args);
}

function spotifyAuthHeader() {
  return (
    "Basic " +
    Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")
  );
}

function getRoomSize(roomId) {
  return io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
}

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/* ══════════════════════════════════════════════════════════════════════════════
   Spotify OAuth Routes
══════════════════════════════════════════════════════════════════════════════ */

// Step 1 — Redirect to Spotify login
app.get("/login", (_req, res) => {
  const scope = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
  ].join(" ");

  const authURL =
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id:     SPOTIFY_CLIENT_ID,
      scope,
      redirect_uri:  SPOTIFY_REDIRECT_URI,
    });

  res.redirect(authURL);
});

// Step 2 — OAuth callback
app.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    log("error", "Spotify denied access:", error);
    return res.redirect(`${FRONTEND_URL}?auth_error=access_denied`);
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
      {
        headers: {
          Authorization:  spotifyAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Tokens go in URL params — acceptable for SPAs; upgrade to HttpOnly
    // cookies for higher security in the future.
    res.redirect(
      `${FRONTEND_URL}/?access_token=${access_token}` +
      `&refresh_token=${refresh_token}&expires_in=${expires_in}`
    );
  } catch (err) {
    log("error", "Spotify token exchange failed:", err.response?.data?.error ?? err.message);
    res.redirect(`${FRONTEND_URL}?auth_error=token_exchange_failed`);
  }
});

// Step 3 — Refresh access token
app.get("/refresh", async (req, res) => {
  const { refresh_token } = req.query;

  if (!refresh_token) {
    return res.status(400).json({ error: "refresh_token is required" });
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
      }),
      {
        headers: {
          Authorization:  spotifyAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Return only what the client needs
    const { access_token, expires_in } = response.data;
    res.json({ access_token, expires_in });
  } catch (err) {
    log("error", "Token refresh failed:", err.response?.data?.error ?? err.message);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   Socket.io — Room & Playback Logic
══════════════════════════════════════════════════════════════════════════════ */

const MAX_ROOM_SIZE = 2; // Only two people per room

io.on("connection", (socket) => {
  log("info", `Socket connected: ${socket.id}`);

  // Track which room this socket is in (one room per socket)
  let currentRoom = null;

  // ── Create Room ────────────────────────────────────────────────────────────
  socket.on("create-room", ({ roomId } = {}, callback) => {
    if (typeof callback !== "function") return;
    if (!roomId || typeof roomId !== "string") {
      return callback({ success: false, error: "Invalid room ID." });
    }

    // Don't allow re-creating an existing room with occupants
    if (getRoomSize(roomId) > 0) {
      return callback({ success: false, error: "Room ID already in use." });
    }

    socket.join(roomId);
    currentRoom = roomId;
    log("info", `Room created: ${roomId} by ${socket.id}`);
    callback({ success: true, roomId });
  });

  // ── Join Room ──────────────────────────────────────────────────────────────
  socket.on("join-room", ({ roomId } = {}, callback) => {
    if (typeof callback !== "function") return;
    if (!roomId || typeof roomId !== "string") {
      return callback({ success: false, error: "Invalid room ID." });
    }

    const size = getRoomSize(roomId);

    if (size === 0) {
      return callback({ success: false, error: "Room not found." });
    }
    if (size >= MAX_ROOM_SIZE) {
      return callback({ success: false, error: "Room is full." });
    }

    socket.join(roomId);
    currentRoom = roomId;
    log("info", `Socket ${socket.id} joined room: ${roomId}`);

    // Notify the other partner
    socket.to(roomId).emit("partner-joined");

    callback({ success: true, roomId });
  });

  // ── Leave Room ─────────────────────────────────────────────────────────────
  socket.on("leave-room", ({ roomId } = {}) => {
    if (!roomId) return;
    socket.leave(roomId);
    socket.to(roomId).emit("partner-left");
    currentRoom = null;
    log("info", `Socket ${socket.id} left room: ${roomId}`);
  });

  // ── Playback Control ───────────────────────────────────────────────────────
  socket.on("control", ({ event, roomId, timestamp } = {}) => {
    // Validate payload
    if (!roomId || !event) return;
    if (!["play", "pause"].includes(event)) return;

    // Ensure sender is actually in the room they claim
    if (!socket.rooms.has(roomId)) {
      log("info", `Unauthorized control attempt by ${socket.id} for room ${roomId}`);
      return;
    }

    const payload = { roomId, timestamp: timestamp ?? Date.now() };

    if (event === "play") {
      io.to(roomId).emit("sync-play", payload);
      log("info", `sync-play → room ${roomId}`);
    } else {
      io.to(roomId).emit("sync-pause", payload);
      log("info", `sync-pause → room ${roomId}`);
    }
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    log("info", `Socket disconnected: ${socket.id} — reason: ${reason}`);

    // Notify partner if they were in a room together
    if (currentRoom) {
      socket.to(currentRoom).emit("partner-left");
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   Start Server + Graceful Shutdown
══════════════════════════════════════════════════════════════════════════════ */

server.listen(PORT, () => {
  log("info", `Server running on http://localhost:${PORT} [${NODE_ENV}]`);
});

function shutdown(signal) {
  log("info", `${signal} received — shutting down gracefully`);
  io.close();
  server.close(() => {
    log("info", "HTTP server closed.");
    process.exit(0);
  });
  // Force exit if graceful close hangs
  setTimeout(() => process.exit(1), 8000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));