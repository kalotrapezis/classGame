# ClassGame (v0.1.0-alpha)

A local multiplayer drawing and guessing game inspired by Skribbl.io. Players take turns drawing while others try to guess the word!

## Features

- 🎨 **Real-time Drawing** - Smooth drawing canvas with multiple tools (pencil, eraser, fill, clear)
- 🎮 **Multiplayer Fun** - Play with friends on your local network
- 🏆 **Scoring System** - Points based on how quickly you guess (2000 max, 100 min)
- 😀 **Emoji Avatars** - Choose from 16 fun emoji avatars
- 🎯 **Custom Words** - Add your own words (supports any language, including Greek!)
- ⚙️ **Customizable** - Configure rounds (2-5), draw time (60-120s), and word count (3-8)
- 📋 **Easy Sharing** - Copy invite link with one click

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

1. **Create a Room**: Enter your name, choose an emoji avatar, and click "Create Room"
2. **Invite Friends**: Share the invite link with your friends
3. **Start the Game**: Once everyone has joined (minimum 2 players), click "Start Game"
4. **Draw or Guess**: 
   - When it's your turn to draw, choose a word and draw it
   - When you're guessing, type your guess in the chat
5. **Score Points**: 
   - Guessers earn 2000 points (maximum) for quick guesses, down to 100 points minimum
   - Drawer earns 50% of points from each correct guess

## Game Settings (Host Only)

- **Rounds**: 2-5 rounds
- **Draw Time**: 60-120 seconds per turn
- **Word Count**: 3-8 word choices
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
