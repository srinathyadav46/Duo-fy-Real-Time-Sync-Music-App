# 🎧 Duo-fy — Real-Time Sync Music App

Duo-fy is a full-stack MERN web application that enables two users to listen to Spotify together in real time. It synchronizes playback actions like play, pause, and track changes across connected users using WebSockets.

Built as a production-style project demonstrating real-time communication, OAuth authentication, and full-stack architecture.

---

## 🚀 Features

- 🔐 Spotify OAuth authentication
- 🎵 Real-time music synchronization
- 👥 Room-based listening sessions
- 📡 WebSocket-powered instant updates
- 📱 Fully responsive (desktop + mobile)
- ⚡ Clean UI with smooth transitions

---

## 🛠 Tech Stack

**Frontend**
- React (Vite)
- Tailwind CSS

**Backend**
- Node.js
- Express.js
- Socket.io

**Database**
- MongoDB

**Authentication**
- Spotify Web API (OAuth 2.0)

---

## 🏗 Architecture Overview

- React handles UI and state management
- Express API manages authentication and business logic
- Socket.io ensures real-time playback sync
- MongoDB stores session/room data
- Spotify API controls playback and user authentication

---

## ⚙️ Installation (Run Locally)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/Duo-fy-Real-Time-Sync-Music-App.git
cd Duo-fy-Real-Time-Sync-Music-App
```

### 2. Setup Backend

```bash
cd server
npm install
```

Create a `.env` file inside `server/`:

```
PORT=5000
MONGO_URI=your_mongodb_uri
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5000/auth/callback
```

Start backend:

```bash
npm start
```

---

### 3. Setup Frontend

```bash
cd client
npm install
npm run dev
```

---

## 🌍 Deployment

Deployment target: Oracle Cloud (OCI Compute Instance)

- Nginx reverse proxy
- PM2 process manager
- Single-domain hybrid deployment

(Live URL will be added after deployment.)

---

## 📌 Project Highlights

- Real-time bidirectional communication
- OAuth flow implementation
- Clean separation of client/server architecture
- Production-style deployment configuration
- Resume-ready full-stack system

---

## 📄 License

This project is built for educational and portfolio purposes.
