# ClassGame Project Context

## Project Overview
**ClassGame** (v2.1.0) is a local network multiplayer drawing and guessing game (Skribbl.io clone) designed for classrooms.
- **Goal:** Players take turns drawing words while others guess.
- **Connectivity:** Local Area Network (LAN) via WebSocket (Socket.IO). No internet required.
- **Platform:** Electron Desktop App (Host/Server) + Browser Clients (Players).

## Architecture
Monorepo-style structure with `client` and `server` directories.

### 1. Server (`/server`)
- **Runtime:** Node.js + Electron.
- **Frameworks:** Express (HTTP), Socket.IO (Real-time), Bonjour (Discovery).
- **Entry Point:** `index.js` (Game Logic) / `electron-main.js` (App Window).
- **Key Logic:**
  - **Room State:** Single global `room` object (`index.js`).
  - **Game Loop:** Managed via `setInterval` in `startGame`/`startTurn`.
  - **Words:** Hardcoded arrays `WORDS_EN` and `WORDS_GR`.
  - **Discovery:** `network-discovery.js` broadcasts service for clients to find.

### 2. Client (`/client`)
- **Runtime:** Browser / Electron Renderer.
- **Frameworks:** Vanilla JS, Vite (Build tool).
- **Entry Point:** `src/main.js` (Logic) -> `index.html` (DOM).
- **Key Logic:**
  - **Canvas:** HTML5 Canvas (`#drawing-canvas`) with 800x600 fixed resolution.
  - **Socket:** `socket.io-client` connects to dynamic IP.
  - **UI:** Direct DOM manipulation (no React/Vue).

## Key Files & Paths
- **Server Logic:** `c:\Users\Teo\.gemini\antigravity\scratch\classGame\server\index.js`
- **Client Logic:** `c:\Users\Teo\.gemini\antigravity\scratch\classGame\client\main.js`
- **Styles:** `c:\Users\Teo\.gemini\antigravity\scratch\classGame\client\style.css`
- **Build Output:** `server/public` (Client builds here).

## Important Variables & Constants
### Server (`index.js`)
- `MAX_PLAYERS`: 20
- `room`: Global state { status, players, game: { ... } }
- `WORDS_EN` / `WORDS_GR`: Word lists.
- `CONNECTION_RATE_LIMIT_MS`: 100ms (0 in test mode).

### Client (`main.js`)
- `gameState`: Global state { screen, name, isHost, ... }
- `CANVAS_WIDTH/HEIGHT`: 800x600.
- `currentThrottleMs`: Adaptive (50-150ms) for drawing packets.
- `socket`: Global Socket.IO instance.

## Common Workflows
1.  **Run Server (Dev):** `cd server && npm run dev`
2.  **Run Client (Dev):** `cd client && npm run dev`
3.  **Build Client:** `cd client && npm run build` (deploys to `server/public`)
4.  **Package Electron:** `cd server && npm run package` (or `make`)

## Troubleshooting / Quirks
- **IP Discovery:** Uses `internal-ip` and `bonjour-service`. Complex logic in `network-discovery.js`.
- **Canvas Sync:** Batched drawing actions (`draw-batch`) to optimize WiFi performance.
- **Reconnection:** Client auto-reconnects and `server/index.js` restores score if name matches.
