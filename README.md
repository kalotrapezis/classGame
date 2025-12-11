# ClassGame (v0.3.1)

A local multiplayer drawing and guessing game inspired by Skribbl.io. Players take turns drawing while others try to guess the word!

## Features

- 🎨 **Real-time Drawing** - Smooth drawing canvas with multiple tools (pencil, eraser, fill, clear)
- 🎮 **Multiplayer Fun** - Play with friends on your local network
- 🔗 **Simple Joining** - Just share `192.168.x.x:3000` - no room codes needed!
- 🏆 **Scoring System** - Points based on how quickly you guess (2000 max, 100 min)
- 🔄 **Score Recovery** - Reconnecting players get their score back automatically
- 💡 **Hint System** - Random letters reveal automatically during the game
- 🥇 **Game Over Podium** - Celebrate the top 3 winners with a fun podium display
- 😀 **Emoji Avatars** - Choose from 16 fun emoji avatars
- 🎯 **Custom Words** - Add your own words (comma-separated)
- 🇬🇷 **Greek Language** - Built-in support for Greek with 98 words and accent-insensitive matching
- ⚙️ **Customizable** - Configure rounds (2-5), draw time (60-120s), word count (3-8), and hints (2-5)
- 📱 **Responsive** - Works on tablets and smaller screens with proper scrolling

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kalotrapezis/ClassGame.git
cd ClassGame
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Install client dependencies and build:
```bash
cd ../client
npm install
npm run build
```

4. Start the server:
```bash
cd ../server
npm start
```

5. Open your browser and go to `http://localhost:3000`

## How to Play

1. **Join the Game**: Enter your name, choose an emoji avatar, and click "Play!"
2. **Invite Friends**: Share the server URL with your friends (just the IP and port!)
3. **Start the Game**: Once everyone has joined (minimum 2 players), the host clicks "Start Game"
4. **Draw or Guess**: 
   - When it's your turn to draw, choose a word and draw it
   - When you're guessing, type your guess in the chat
5. **Score Points**: 
   - Guessers earn 2000 points (maximum) for quick guesses, down to 100 points minimum
   - Drawer earns 50% of points from each correct guess
6. **Reconnect**: If you disconnect, rejoin with the same name to get your score back!

## Game Settings (Host Only)

- **Rounds**: 2-5 rounds
- **Draw Time**: 60-120 seconds per turn
- **Word Count**: 3-8 word choices
- **Hints**: 2-5 hints per turn
- **Custom Words**: Add your own words (comma-separated)
- **My Words Only**: Use only your custom words instead of defaults

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **Backend**: Node.js, Express, Socket.IO
- **Build Tool**: Vite

## Development

### Client Development

```bash
cd client
npm run dev
```

### Making Changes

After making changes to the client:
```bash
cd client
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

Created by Teo Kalotrapezis

Inspired by [Skribbl.io](https://skribbl.io)

---

> [!NOTE]
> This is an AI vibecoded app and the Opus 4.5 is pretty great! 🤖✨
