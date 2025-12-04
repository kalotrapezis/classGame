# ClassGame - Release Notes

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
