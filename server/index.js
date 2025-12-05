const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const NetworkDiscovery = require('./network-discovery');
const TLSConfig = require('./tls-config');

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
const LOCAL_IP = getLocalIP();
console.log('Local IP:', LOCAL_IP);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// TLS/HTTPS support
const USE_TLS = process.env.USE_TLS === 'true' || false;
let server;
if (USE_TLS) {
  const tlsConfig = new TLSConfig();
  server = https.createServer(tlsConfig.getCredentials(), app);
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const networkDiscovery = new NetworkDiscovery();

// --- GAME CONSTANTS ---
const WORDS = [
  "apple", "banana", "carrot", "dog", "elephant", "fish", "guitar", "house", "ice cream", "jellyfish",
  "kite", "lion", "moon", "nest", "orange", "penguin", "queen", "rabbit", "sun", "tree",
  "umbrella", "violin", "watermelon", "xylophone", "yacht", "zebra", "airplane", "ball", "cat", "door"
];

// --- GAME STATE ---
const rooms = new Map(); // roomId -> { settings, players: [], status: 'lobby'|'playing', hostId }

// Helper: Get random words
function getWords(count, settings) {
  // If My Words Only is enabled and custom words exist
  if (settings && settings.myWordsOnly && settings.customWords) {
    const customWordList = settings.customWords
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (customWordList.length > 0) {
      const shuffled = customWordList.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, shuffled.length));
    }
  }

  // Otherwise use default words (optionally mixed with custom)
  let wordPool = [...WORDS];
  if (settings && settings.customWords) {
    const customWordList = settings.customWords
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);
    wordPool = [...wordPool, ...customWordList];
  }

  const shuffled = wordPool.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper: Levenshtein Distance
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-game', ({ roomId, userName, avatar }, callback) => {
    if (rooms.has(roomId)) {
      return callback({ success: false, message: 'Room already exists' });
    }

    const newRoom = {
      id: roomId,
      hostId: socket.id,
      status: 'lobby',
      settings: {
        rounds: 3,
        drawTime: 80,
        wordCount: 3,
        hints: 2,
        customWords: '',
        myWordsOnly: false
      },
      players: [],
      game: {
        currentRound: 0,
        currentDrawerIndex: -1,
        currentWord: null,
        timer: 0,
        interval: null,
        wordOptions: [],
        revealedIndices: [],
        hintTimeouts: []
      }
    };

    rooms.set(roomId, newRoom);
    joinRoom(socket, roomId, userName, avatar, true);
    callback({ success: true });
  });

  socket.on('join-game', ({ roomId, userName, avatar }, callback) => {
    let room = rooms.get(roomId);

    // Auto-create public room if it doesn't exist
    if (!room && roomId === 'public-room') {
      room = {
        id: roomId,
        hostId: socket.id, // First joiner becomes host
        status: 'lobby',
        settings: { rounds: 3, drawTime: 80, wordCount: 3, hints: 2, customWords: '' },
        players: [],
        game: { currentRound: 0, currentDrawerIndex: -1, currentWord: null, timer: 0, interval: null, wordOptions: [], revealedIndices: [], hintTimeouts: [] }
      };
      rooms.set(roomId, room);
    } else if (!room) {
      return callback({ success: false, message: 'Room not found' });
    }

    const isHost = room.players.length === 0; // If empty, become host
    if (isHost) room.hostId = socket.id;

    joinRoom(socket, roomId, userName, avatar, isHost);

    callback({
      success: true,
      isHost,
      settings: room.settings
    });
  });

  socket.on('update-settings', ({ roomId, settings }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    room.settings = settings;
    socket.to(roomId).emit('settings-update', settings);
  });

  socket.on('send-chat', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // GUESSING LOGIC
    if (room.status === 'drawing' && room.game.currentWord) {
      const isDrawer = room.players[room.game.currentDrawerIndex].id === socket.id;
      const targetWord = room.game.currentWord.toLowerCase();
      const guess = message.trim().toLowerCase();

      if (isDrawer) {
        io.to(roomId).emit('chat-message', {
          sender: player.name,
          content: message,
          system: false
        });
        return;
      }

      if (player.hasGuessed) {
        io.to(roomId).emit('chat-message', {
          sender: player.name,
          content: message,
          system: false
        });
        return;
      }

      // Correct Guess
      if (guess === targetWord) {
        player.hasGuessed = true;

        // Calculate Score
        // Max 2000 points, scales down with time
        const totalTime = room.settings.drawTime;
        const timeLeft = room.game.timer;
        const ratio = timeLeft / totalTime;
        const pointsEarned = Math.max(100, Math.floor(2000 * ratio)); // Minimum 100 points

        player.score += pointsEarned;

        // Award points to drawer (50% of guesser's points)
        const drawer = room.players[room.game.currentDrawerIndex];
        if (drawer) {
          drawer.score += Math.floor(pointsEarned * 0.5);
        }

        io.to(roomId).emit('chat-message', {
          sender: player.name,
          content: `${player.name} guessed the word! (+${pointsEarned})`,
          system: true,
          isCorrect: true
        });

        // Update player scores immediately
        io.to(roomId).emit('player-update', room.players);

        // Check if all guessers have guessed
        const guessers = room.players.filter(p => p.id !== room.players[room.game.currentDrawerIndex].id);
        if (guessers.every(p => p.hasGuessed)) {
          endTurn(room);
        }
        return;
      }

      // Close Guess
      const dist = levenshtein(guess, targetWord);
      const threshold = targetWord.length > 5 ? 2 : 1;

      if (dist > 0 && dist <= threshold) {
        socket.emit('chat-message', {
          content: `'${message}' is close!`,
          system: true,
          isClose: true
        });
      }
    }

    io.to(roomId).emit('chat-message', {
      sender: player.name,
      content: message,
      system: false
    });
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    // Require at least 2 players
    if (room.players.length < 2) {
      socket.emit('chat-message', {
        system: true,
        content: 'Need at least 2 players to start the game!'
      });
      return;
    }

    startGame(room);
  });

  socket.on('select-word', ({ roomId, word }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'selecting') return;

    const drawer = room.players[room.game.currentDrawerIndex];
    if (drawer.id !== socket.id) return;

    startDrawingPhase(room, word);
  });

  socket.on('draw-line', (data) => {
    socket.to(data.roomId).emit('draw-line', data);
  });

  socket.on('draw-action', (data) => {
    socket.to(data.roomId).emit('draw-action', data);
  });

  socket.on('get-server-info', (data, callback) => {
    if (typeof data === 'function') callback = data;
    const address = server.address();
    callback({
      ip: LOCAL_IP,
      port: address ? address.port : (process.env.PORT || 3000)
    });
  });

  socket.on('disconnect', () => {
    // Find room user was in
    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        io.to(roomId).emit('chat-message', {
          content: `${player.name} left the game.`,
          system: true
        });

        // Handle Host Migration
        if (room.hostId === socket.id && room.players.length > 0) {
          room.hostId = room.players[0].id;
          room.players[0].isHost = true;
          io.to(roomId).emit('chat-message', {
            content: `${room.players[0].name} is now the host.`,
            system: true
          });
        }

        // Cleanup empty room
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('player-update', room.players);
        }
        break;
      }
    }
  });
});

// --- GAME LOGIC ---

function startGame(room) {
  room.status = 'playing';
  room.game.currentRound = 1;
  room.game.currentDrawerIndex = -1;
  io.to(room.id).emit('game-started');
  startTurn(room);
}

function startTurn(room) {
  // Reset guess state
  room.players.forEach(p => p.hasGuessed = false);

  // Move to next player
  room.game.currentDrawerIndex++;

  // Check if round ended
  if (room.game.currentDrawerIndex >= room.players.length) {
    room.game.currentRound++;
    room.game.currentDrawerIndex = 0;

    if (room.game.currentRound > room.settings.rounds) {
      endGame(room);
      return;
    }
  }

  const drawer = room.players[room.game.currentDrawerIndex];
  room.status = 'selecting';
  room.game.wordOptions = getWords(room.settings.wordCount || 3, room.settings);

  // Notify everyone who is drawing
  io.to(room.id).emit('turn-update', {
    drawerId: drawer.id,
    round: room.game.currentRound,
    totalRounds: room.settings.rounds
  });

  // Send words to drawer
  io.to(drawer.id).emit('word-selection', room.game.wordOptions);

  // Start selection timer (15s)
  startTimer(room, 15, () => {
    // Auto-select random word if time runs out
    const randomWord = room.game.wordOptions[Math.floor(Math.random() * room.game.wordOptions.length)];
    startDrawingPhase(room, randomWord);
  });
}

function startDrawingPhase(room, word) {
  room.status = 'drawing';
  room.game.currentWord = word;
  room.game.revealedIndices = [];

  // Clear any previous hint timeouts
  if (room.game.hintTimeouts) {
    room.game.hintTimeouts.forEach(t => clearTimeout(t));
  }
  room.game.hintTimeouts = [];

  // Notify everyone
  io.to(room.id).emit('drawing-phase-start', {
    wordLength: word.length,
    drawTime: room.settings.drawTime
  });

  // Send actual word to drawer so they know what to draw
  const drawer = room.players[room.game.currentDrawerIndex];
  io.to(drawer.id).emit('your-word', word);

  // Schedule hints at evenly distributed times
  const numHints = room.settings.hints || 2;
  const drawTime = room.settings.drawTime;

  for (let i = 1; i <= numHints; i++) {
    // Reveal hints at evenly spaced intervals (excluding first and last 5 seconds)
    const hintTime = Math.floor((drawTime - 5) * (i / (numHints + 1))) * 1000;
    const timeout = setTimeout(() => {
      revealHint(room);
    }, hintTime);
    room.game.hintTimeouts.push(timeout);
  }

  startTimer(room, room.settings.drawTime, () => {
    endTurn(room);
  });
}

function revealHint(room) {
  const word = room.game.currentWord;
  if (!word) return;

  // Find indices of letters that haven't been revealed yet (skip spaces)
  const availableIndices = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ' && !room.game.revealedIndices.includes(i)) {
      availableIndices.push(i);
    }
  }

  if (availableIndices.length === 0) return;

  // Pick random index to reveal
  const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  room.game.revealedIndices.push(randomIndex);

  // Build the hint string (underscores with revealed letters)
  let hintDisplay = '';
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ' ') {
      hintDisplay += '  '; // Double space for word separator
    } else if (room.game.revealedIndices.includes(i)) {
      hintDisplay += word[i].toUpperCase() + ' ';
    } else {
      hintDisplay += '_ ';
    }
  }

  // Send hint update to everyone except the drawer
  const drawer = room.players[room.game.currentDrawerIndex];
  room.players.forEach(p => {
    if (p.id !== drawer.id) {
      io.to(p.id).emit('hint-update', hintDisplay.trim());
    }
  });
}

function endTurn(room) {
  // Clear hint timeouts
  if (room.game.hintTimeouts) {
    room.game.hintTimeouts.forEach(t => clearTimeout(t));
    room.game.hintTimeouts = [];
  }

  // Reveal word
  io.to(room.id).emit('turn-end', { word: room.game.currentWord });

  // Wait 5s then next turn
  startTimer(room, 5, () => {
    startTurn(room);
  });
}

function endGame(room) {
  room.status = 'ended';
  io.to(room.id).emit('game-ended', { players: room.players });
  // Reset room state for next game?
}

function startTimer(room, seconds, onComplete) {
  if (room.game.interval) clearInterval(room.game.interval);

  room.game.timer = seconds;
  io.to(room.id).emit('timer-update', room.game.timer);

  room.game.interval = setInterval(() => {
    room.game.timer--;
    io.to(room.id).emit('timer-update', room.game.timer);

    if (room.game.timer <= 0) {
      clearInterval(room.game.interval);
      if (onComplete) onComplete();
    }
  }, 1000);
}

function joinRoom(socket, roomId, userName, avatar, isHost) {
  const room = rooms.get(roomId);
  const player = {
    id: socket.id,
    name: userName,
    avatar,
    score: 0,
    isHost,
    hasGuessed: false
  };

  room.players.push(player);
  socket.join(roomId);

  // Notify others
  io.to(roomId).emit('player-update', room.players);
  io.to(roomId).emit('chat-message', {
    content: `${userName} joined the game!`,
    system: true
  });
}

const START_PORT = parseInt(process.env.PORT) || 3000;

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);

    // Start mDNS (if enabled)
    // try {
    //   networkDiscovery.initialize();
    // } catch (err) {
    //   console.error('Failed to initialize network discovery:', err);
    // }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(START_PORT);
