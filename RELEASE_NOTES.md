# ClassGame - Release Notes

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
