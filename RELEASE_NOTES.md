# ClassGame - Release Notes

## v2.0.1 (2026-02-11)
### Bug Fixes
- **Installer Launch Fix**: Resolved an issue where the app would run as a process but the window wouldn't open. The app now waits for the server to be fully ready before opening the UI.
- **Port Conflict Handling**: The app now automatically detects if port 3001 is busy and switches to the next available port (e.g., 3002), ensuring it always launches successfully.

---

## v2.0.0 (2026-02-11) 🚀
### Major Features
- **Expanded Word Lists**: Added over 160 new words across diverse categories like Landscape, Science, Emotions, Mythology, and History for both Greek and English.
- **Improved Visibility**: Replaced the standard crosshair cursor with a custom SVG cursor that uses black and white strokes, ensuring maximum visibility on any background.
- **Architecture Revamp**: Introduced "Make a Game" and "Join Game" buttons. The first person to "Make a Game" becomes the host/server for that session.
- **Smart IP**: Simplified connection process—clients only need to type the last digits of the server's IP address.
- **Port Change**: Moved to port **3001** to prevent conflicts with other applications (like ClassSend).

### UI/UX
- **Toolbox Polish**: Refined the drawing tools and icons for better consistency.

---

## v1.2.2 (2026-01-21) 📦
### Build & Distribution
- **Windows 32-bit Support**: Added official support for Windows 32-bit builds via Zip archive.
- **Linux AppImage Support**: Fixed AppImage generation by updating build dependencies to be compatible with the latest Electron Forge.

---

## v1.2.1 (2026-01-16)
### Bug Fixes
- **Player Sorting Fix**: Player list now sorts by score (descending) to show leaders at the top.
- **Browser Drawing Tools**: Fixed CSS layout issue where drawing toolbar was hidden or pushed off-screen in web browsers.
- **Linux System Tray**: Fixed missing tray icon on Linux and improved app closing behavior.

---

## v1.2.0 (2025-12-25) 🎄

### Bug Fixes
- **Ghost Players Fix**: Fixed bug where changing name and rejoining would leave a "ghost" player entry that couldn't be removed
- **Drawing Order Sync**: Fixed desync where the wrong player would be shown as drawer due to array index shifting when players join/leave
- **Drawer Disconnect Handling**: When the drawer leaves mid-round, the turn now ends immediately and moves to the next player (with a 3 second delay)
- **Drawer Rotation Fix**: Fixed bug where the same player would draw again at the start of a new round instead of rotating to the next player

---

## v1.1.1 (2025-12-17)

### Bug Fixes
- **Vote Limit Reset**: The 3-vote limit per player now correctly resets at the end of each game, so players get fresh votes for every new game.

---

## v1.1.0 (2025-12-17)

### UI Improvements
- **Restart Button Label**: The host's restart button now displays "🔄 Restart" with clear text instead of just an icon, making it more user-friendly

---

## v1.0.0 (2025-12-15) 🎉

### Major New Feature: Voting System 🗳️
A new anti-cheating system that allows players to vote against suspected cheaters!

- **🗳️ Vote Icons**: Click the ballot box icon next to any player's name to start a vote
- **Floating Vote Modal**: All players see a popup with 👍 Keep / 👎 Penalize buttons
- **20 Second Timer**: Votes auto-resolve after countdown
- **Majority Rules**: Only actual votes count (abstentions ignored)
- **Heavy Penalties**:
  - Vote **passes** (majority 👎): Target loses **4000 points**
  - Vote **fails** (majority 👍 or tie): Initiator loses **1000 points**
- **Rate Limiting**: 
  - Each player can only start 1 vote per game round
  - Only 1 vote can be active at a time

### UI/Layout Fixes
- **Fixed Chat Scroll**: Chat messages now scroll within their own container instead of expanding the entire page
- **Game Screen Constrained**: Game screen uses fixed viewport height (100vh) to prevent layout issues
- **Lobby Settings Scroll**: Settings form is now scrollable with reduced padding for better fit

### Stability Improvements
- **Server Crash Fix**: Added null check in `revealHint()` to prevent crash when drawer disconnects mid-hint
- **Clean Asset Builds**: Fixed Vite build to properly output CSS and JS bundles

---

## v0.4.0 (2025-12-12)

### New Features
- **Difficulty Toggle** 🎯: Choose between Easy and Hard modes in lobby settings
  - **Easy Mode**: Case-insensitive, ignores Greek accents (σπίτι = ΣΠΙΤΙ = σπιτι)
  - **Hard Mode**: Exact match required - correct case AND Greek accents (τόνοι) must be correct
- **Auto-Reconnect** 🔄: Players automatically rejoin if WiFi connection drops
  - Visual "Reconnecting..." overlay with spinner
  - Up to 20 reconnection attempts with exponential backoff
  - Preserves player scores on reconnect

### WiFi Stability Improvements
- **Adaptive Throttling** 📶: Drawing data is batched based on network quality
  - Good connection (< 50ms): 50ms batches
  - Slow connection (> 200ms): 150ms batches
  - Reduces network load by 60-80%
- **Increased Wait Time**: 8 seconds between rounds (was 5) to allow disconnected clients to reconnect
- **Extended Timeouts**: 60-second ping timeout prevents premature disconnections on slow WiFi
- **Batched Drawing Events**: Multiple draw actions sent as single packets to reduce network overhead

### Technical Changes
- Added `ping-check` event for client to measure connection latency
- Socket.io configured with `pingTimeout: 60000`, `pingInterval: 25000`
- Draw events use adaptive interval based on measured RTT
- `draw-batch` event for efficient multi-line transmission

---

## v0.3.1 (2025-12-11)

### New Features
- **Greek Language Support** 🇬🇷: Added language selector (English/Greek) in lobby settings
- **98 Greek Words**: Comprehensive word list including everyday objects, body parts, professions, and actions

### Bug Fixes
- **Accent-Insensitive Matching**: Guesses now work with or without Greek accents (σπίτι = σπιτι = ΣΠΙΤΙ)
- **Case-Insensitive Matching**: Uppercase and lowercase letters are treated the same
- **Hints in Original Case**: Revealed letters now show in lowercase instead of uppercase
- **Fixed Canvas Consistency**: Canvas now uses fixed 800x600 resolution for identical drawing across all screen sizes
- **Tablet/Mobile Scroll**: Fixed scrolling issues on devices with small screens - toolbar and chat now accessible

### Technical Changes
- Canvas uses fixed internal resolution with CSS scaling
- Body overflow changed from `hidden` to `auto` for proper scrolling
- Added `100dvh` (dynamic viewport height) for better mobile support

---

## v0.3.0 (2025-12-08)

### Major Changes
- **Single Room Per Server**: Simplified architecture - no more room codes! Students just visit `192.168.x.x:3000` directly
- **Removed "Create Private Room"**: Now everyone joins the same room automatically

### Stability Improvements
- **Crash Prevention**: Added global exception handlers to keep server running
- **Connection Rate Limiting**: Prevents rapid reconnection spam from overwhelming server
- **Memory Management**: Canvas actions capped at 2000 to prevent memory leaks
- **Room Cleanup**: Proper timer/interval cleanup when games end or all players leave
- **MAX_PLAYERS Limit**: Room capped at 20 players to prevent overload

### New Features
- **Score Persistence on Reconnect**: If a player disconnects and rejoins with the same name, their score is restored!
- **Late Joiner Support**: Players joining mid-game are synced directly into the game (see current drawing, timer, round)
- **Canvas Resize Preservation**: Drawing actions are replayed on window resize instead of scaling (no more blur!)

### Bug Fixes
- **Fixed Fill Tool**: Flood fill now checks all color components (RGBA) instead of just red - no more color bleeding
- **Fixed Zombie Rooms**: Old rooms no longer persist with running timers after games end

### UI Improvements
- **Responsive Toolbar**: Drawing tools wrap on narrow screens instead of being cut off
- **Better Breakpoints**: Added responsive layouts for 1000px, 850px, and 600px screens
- **Players Panel Hidden on Small Screens**: Automatically hides to give more canvas space

---

## v0.2.0 (2025-12-05)

### New Features
- **Hint System**: Random letters are now revealed automatically during the drawing phase to help guessers.
- **Game Over Podium**: A new game-over screen celebrates the top 3 winners with a podium display, avatars, and medals! 🏅🥈🥉
- **Hints Setting**: Hosts can now configure the number of hints (2-5) in the lobby settings.

### Improvements
- **URL Format**: Updated room invite URLs to use a shorter, cleaner format (e.g., `/?123`).
- **Layout**: Optimized the game layout for better usability on both PC and tablets.
  - Canvas height adjusted to ensure toolbar visibility.
  - Player list and chat panels now match the canvas height and have scrollbars.
  - Page is now scrollable if content exceeds the viewport.

---

## v0.1.1-alpha (2025-12-04)

### Bug Fixes
- **Toolbar Visibility**: Fixed drawing tools not appearing for the drawer during their turn
- **Flood Fill Algorithm**: Implemented proper flood-fill for the paint bucket tool - now respects line boundaries instead of filling entire canvas

### Technical Improvements
- Added pixel-by-pixel flood-fill algorithm with boundary detection
- Enhanced toolbar visibility logic in turn-update and drawing-phase-start events
- Updated socket handlers to pass coordinates for fill operations

---

## v0.1.0-alpha (2025-12-04)

### Initial Release Features
- Real-time multiplayer drawing and guessing game
- Emoji avatar system (16 avatars to choose from)
- Skribbl-like scoring system (2000 points max, decreasing with time)
- Drawing tools: Pencil, Eraser, Fill, Clear
- Customizable game settings (rounds, draw time, word count)
- Custom words support (any language, including Greek!)
- "My Words Only" mode
- Minimum 2 players required to start
- Clean, modern UI with responsive design
- Copy invite link functionality
- Local network multiplayer with automatic IP detection

### Known Issues
- No mDNS/Bonjour support (disabled for stability)
- Game over screen pending
- "Guessed" indicator for players pending
- Votekick functionality pending
