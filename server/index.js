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
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,      // Wait 60s before considering client disconnected
  pingInterval: 25000,     // Ping every 25s to keep connection alive
  connectTimeout: 30000    // Allow 30s for initial connection
});

const networkDiscovery = new NetworkDiscovery();

// --- GAME CONSTANTS ---
const MAX_PLAYERS = 20;
const MAX_CANVAS_ACTIONS = 2000;
const CONNECTION_RATE_LIMIT_MS = 100;

// Normalize text: remove accents and convert to lowercase for comparison (EASY mode)
function normalizeText(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Exact text comparison with accents preserved (HARD mode) - just trim whitespace
function normalizeTextHard(str) {
  return str.trim();
}

const WORDS_EN = [
  "apple", "banana", "carrot", "dog", "elephant", "fish", "guitar", "house", "ice cream", "jellyfish",
  "kite", "lion", "moon", "nest", "orange", "penguin", "queen", "rabbit", "sun", "tree",
  "umbrella", "violin", "watermelon", "xylophone", "yacht", "zebra", "airplane", "ball", "cat", "door"
];

const WORDS_GR = [
  "σπίτι", "δέντρο", "σκύλος", "γάτα", "ήλιος", "φεγγάρι", "νερό", "φωτιά", "αέρας", "σύννεφο",
  "βουνό", "θάλασσα", "ποτάμι", "ψάρι", "πουλί", "αμάξι", "ποδήλατο", "μπάλα", "βιβλίο", "καρέκλα",
  "τραπέζι", "πόρτα", "παράθυρο", "κλειδί", "ρολόι", "τηλέφωνο", "χέρι", "πόδι", "μάτι", "μύτη",
  "στόμα", "αυτί", "μαλλιά", "καπέλο", "παπούτσι", "μπλούζα", "παντελόνι", "φόρεμα", "καρδιά", "αστέρι",
  "κύκλος", "τετράγωνο", "τρίγωνο", "γραμμή", "βροχή", "χιόνι", "αστραπή", "κεραυνός", "φως", "σκοτάδι",
  "κέικ", "ψωμί", "μήλο", "μπανάνα", "πορτοκάλι", "σταφύλι", "πιρούνι", "κουτάλι", "μαχαίρι", "πιάτο",
  "φλιτζάνι", "γυαλί", "λουλούδι", "γρασίδι", "πέτρα", "δρόμος", "γέφυρα", "βάρκα", "πλοίο", "αεροπλάνο",
  "τρένο", "λεωφορείο", "ασανσέρ", "σκάλα", "χαρτί", "μολύβι", "σβήστρα", "κανόνας", "σχολείο", "δάσκαλος",
  "μαθητής", "γιατρός", "αστυνόμος", "πυροσβέστης", "μάγειρας", "μουσική", "τραγούδι", "χορός", "ύπνος", "ξύπνιος",
  "τρέξιμο", "περπάτημα", "γέλιο", "κλάμα", "φιλί", "αγκαλιά", "δώρο", "χρήματα"
];

// Only ONE room per server instance
let room = {
  hostId: null,
  status: 'lobby',
  settings: {
    rounds: 3,
    drawTime: 80,
    wordCount: 3,
    hints: 2,
    difficulty: 'easy',
    customWords: '',
    myWordsOnly: false,
    language: 'en'
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
    hintTimeouts: [],
    canvasActions: [],
    activeVote: null,  // { targetId, targetName, initiatorId, votes: {playerId: 'up'|'down'}, timeout }
    playersWhoInitiatedVote: new Set(),  // Track who initiated vote this round
    lastRoundPoints: {}
  }
};

// Store disconnected player scores for reconnection
const disconnectedPlayers = new Map(); // name -> { score, avatar, timestamp }

// Helper: Get random words
function getWords(count, settings) {
  if (settings && settings.myWordsOnly && settings.customWords) {
    const customWordList = settings.customWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
    if (customWordList.length > 0) {
      const shuffled = customWordList.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, shuffled.length));
    }
  }

  // Select word pool based on language
  const baseWords = (settings && settings.language === 'gr') ? WORDS_GR : WORDS_EN;
  let wordPool = [...baseWords];

  if (settings && settings.customWords) {
    const customWordList = settings.customWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
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
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

// --- CONNECTION RATE LIMITING ---
const lastConnectionTime = new Map();

io.on('connection', (socket) => {
  const clientIP = socket.handshake.address || 'unknown';
  const now = Date.now();

  const lastTime = lastConnectionTime.get(clientIP);
  if (lastTime && (now - lastTime) < CONNECTION_RATE_LIMIT_MS) {
    console.log(`Rate limiting connection from ${clientIP}`);
    socket.disconnect(true);
    return;
  }
  lastConnectionTime.set(clientIP, now);

  if (lastConnectionTime.size > 1000) {
    const cutoff = now - 60000;
    for (const [ip, time] of lastConnectionTime.entries()) {
      if (time < cutoff) lastConnectionTime.delete(ip);
    }
  }

  console.log('User connected:', socket.id, 'from', clientIP);

  // --- JOIN GAME (single room, no room ID needed) ---
  socket.on('join-game', ({ userName, avatar }, callback) => {
    // Check max players
    if (room.players.length >= MAX_PLAYERS) {
      return callback({ success: false, message: `Room is full (max ${MAX_PLAYERS} players)` });
    }

    const isHost = room.players.length === 0;
    if (isHost) room.hostId = socket.id;

    const isLateJoiner = room.status !== 'lobby';

    // Check if this player was previously in the game (reconnection)
    let previousScore = 0;
    const normalizedName = userName.trim().toLowerCase();
    if (disconnectedPlayers.has(normalizedName)) {
      const prevData = disconnectedPlayers.get(normalizedName);
      previousScore = prevData.score;
      disconnectedPlayers.delete(normalizedName);
      console.log(`Player ${userName} reconnected with ${previousScore} points`);
    }

    // Add player
    const player = {
      id: socket.id,
      name: userName,
      avatar,
      score: previousScore,
      isHost,
      hasGuessed: false
    };
    room.players.push(player);
    socket.join('game-room');

    io.to('game-room').emit('player-update', room.players);
    io.to('game-room').emit('chat-message', {
      content: `${userName} joined the game!`,
      system: true
    });

    // Sync late joiner
    if (isLateJoiner) {
      const drawer = room.players[room.game.currentDrawerIndex];
      socket.emit('game-sync', {
        status: room.status,
        round: room.game.currentRound,
        totalRounds: room.settings.rounds,
        drawerId: drawer ? drawer.id : null,
        timer: room.game.timer,
        wordLength: room.game.currentWord ? room.game.currentWord.length : 0,
        canvasActions: room.game.canvasActions || [],
        players: room.players
      });
    }

    callback({
      success: true,
      isHost,
      settings: room.settings,
      isLateJoiner
    });
  });

  socket.on('update-settings', ({ settings }) => {
    if (room.hostId !== socket.id) return;
    room.settings = settings;
    socket.to('game-room').emit('settings-update', settings);
  });

  socket.on('send-chat', ({ message }) => {
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // GUESSING LOGIC
    if (room.status === 'drawing' && room.game.currentWord) {
      const isDrawer = room.players[room.game.currentDrawerIndex].id === socket.id;

      // Use difficulty setting for comparison
      const isHardMode = room.settings.difficulty === 'hard';
      const normalizeFunc = isHardMode ? normalizeTextHard : normalizeText;
      const targetWord = normalizeFunc(room.game.currentWord);
      const guess = normalizeFunc(message);

      if (isDrawer) {
        io.to('game-room').emit('chat-message', { sender: player.name, content: message, system: false });
        return;
      }

      if (player.hasGuessed) {
        io.to('game-room').emit('chat-message', { sender: player.name, content: message, system: false });
        return;
      }

      if (guess === targetWord) {
        player.hasGuessed = true;
        const totalTime = room.settings.drawTime;
        const timeLeft = room.game.timer;
        const ratio = timeLeft / totalTime;
        const pointsEarned = Math.max(100, Math.floor(2000 * ratio));

        player.score += pointsEarned;
        room.game.lastRoundPoints[player.id] = pointsEarned;
        const drawer = room.players[room.game.currentDrawerIndex];
        if (drawer) {
          drawer.score += Math.floor(pointsEarned * 0.5);
          room.game.lastRoundPoints[drawer.id] = (room.game.lastRoundPoints[drawer.id] || 0) + Math.floor(pointsEarned * 0.5);
        }

        io.to('game-room').emit('chat-message', {
          sender: player.name,
          content: `${player.name} guessed the word! (+${pointsEarned})`,
          system: true,
          isCorrect: true
        });

        io.to('game-room').emit('player-update', room.players);

        const guessers = room.players.filter(p => p.id !== room.players[room.game.currentDrawerIndex].id);
        if (guessers.every(p => p.hasGuessed)) endTurn();
        return;
      }

      // Close guess detection (always use easy mode normalization for this)
      const distTarget = normalizeText(room.game.currentWord);
      const distGuess = normalizeText(message);
      const dist = levenshtein(distGuess, distTarget);
      const threshold = distTarget.length > 5 ? 2 : 1;
      if (dist > 0 && dist <= threshold) {
        socket.emit('chat-message', { content: `'${message}' is close!`, system: true, isClose: true });
      }
    }

    io.to('game-room').emit('chat-message', { sender: player.name, content: message, system: false });
  });

  socket.on('start-game', () => {
    if (room.hostId !== socket.id) return;
    if (room.players.length < 2) {
      socket.emit('chat-message', { system: true, content: 'Need at least 2 players to start the game!' });
      return;
    }
    startGame();
  });

  socket.on('select-word', ({ word }) => {
    if (room.status !== 'selecting') return;
    const drawer = room.players[room.game.currentDrawerIndex];
    if (drawer.id !== socket.id) return;
    startDrawingPhase(word);
  });

  socket.on('draw-line', (data) => {
    try {
      if (room.game.canvasActions.length < MAX_CANVAS_ACTIONS) {
        room.game.canvasActions.push({ type: 'line', data });
      }
      socket.to('game-room').emit('draw-line', data);
    } catch (err) {
      console.error('Error in draw-line:', err);
    }
  });

  // Batched drawing for WiFi optimization - receives multiple lines at once
  socket.on('draw-batch', (lines) => {
    try {
      lines.forEach(data => {
        if (room.game.canvasActions.length < MAX_CANVAS_ACTIONS) {
          room.game.canvasActions.push({ type: 'line', data });
        }
      });
      socket.to('game-room').emit('draw-batch', lines);
    } catch (err) {
      console.error('Error in draw-batch:', err);
    }
  });

  socket.on('draw-action', (data) => {
    try {
      if (data.type === 'clear') {
        room.game.canvasActions = [];
      } else if (room.game.canvasActions.length < MAX_CANVAS_ACTIONS) {
        room.game.canvasActions.push({ type: 'action', data });
      }
      socket.to('game-room').emit('draw-action', data);
    } catch (err) {
      console.error('Error in draw-action:', err);
    }
  });

  socket.on('get-server-info', (data, callback) => {
    if (typeof data === 'function') callback = data;
    const address = server.address();
    callback({
      ip: LOCAL_IP,
      port: address ? address.port : (process.env.PORT || 3000)
    });
  });

  // Ping check for client to measure latency and adapt throttling
  socket.on('ping-check', (data, callback) => {
    if (typeof data === 'function') callback = data;
    if (typeof callback === 'function') callback();
  });

  // Start a vote against a player
  socket.on('start-vote', ({ targetId }) => {
    // Must be in game
    if (room.status !== 'drawing' && room.status !== 'selecting') return;

    const initiator = room.players.find(p => p.id === socket.id);
    const target = room.players.find(p => p.id === targetId);
    if (!initiator || !target) return;
    if (targetId === socket.id) return; // Can't vote against yourself

    // Check if there's already an active vote
    if (room.game.activeVote) {
      socket.emit('chat-message', { content: 'A vote is already in progress!', system: true });
      return;
    }

    // Check if this player already initiated a vote this round
    if (room.game.playersWhoInitiatedVote.has(socket.id)) {
      socket.emit('chat-message', { content: 'You already initiated a vote this round!', system: true });
      return;
    }

    // Mark this player as having initiated a vote
    room.game.playersWhoInitiatedVote.add(socket.id);

    // Start the vote session
    room.game.activeVote = {
      targetId,
      targetName: target.name,
      initiatorId: socket.id,
      initiatorName: initiator.name,
      votes: {}  // playerId -> 'up' | 'down'
    };

    io.to('game-room').emit('vote-started', {
      targetId,
      targetName: target.name,
      initiatorName: initiator.name
    });

    io.to('game-room').emit('chat-message', {
      content: `🗳️ ${initiator.name} started a vote against ${target.name}! Vote now (20 sec)`,
      system: true
    });

    // Set 20 second timeout
    room.game.activeVote.timeout = setTimeout(() => {
      processVoteResults();
    }, 20000);
  });

  // Cast a vote
  socket.on('cast-vote', ({ vote }) => {
    if (!room.game.activeVote) return;

    const voter = room.players.find(p => p.id === socket.id);
    if (!voter) return;

    // Can't vote if you're the target
    if (socket.id === room.game.activeVote.targetId) return;

    // Record the vote (overwrite if already voted)
    room.game.activeVote.votes[socket.id] = vote; // 'up' or 'down'

    // Count votes
    const votes = Object.values(room.game.activeVote.votes);
    const upVotes = votes.filter(v => v === 'up').length;
    const downVotes = votes.filter(v => v === 'down').length;

    io.to('game-room').emit('vote-update', {
      upVotes,
      downVotes,
      totalVoters: room.players.length - 1
    });
  });

  socket.on('disconnect', () => {
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];

      // Save score for potential reconnection (only if they had points)
      if (player.score > 0) {
        const normalizedName = player.name.trim().toLowerCase();
        disconnectedPlayers.set(normalizedName, {
          score: player.score,
          avatar: player.avatar,
          timestamp: Date.now()
        });
        console.log(`Saved score ${player.score} for ${player.name}`);
      }

      room.players.splice(playerIndex, 1);

      io.to('game-room').emit('chat-message', {
        content: `${player.name} left the game.`,
        system: true
      });

      if (room.hostId === socket.id && room.players.length > 0) {
        room.hostId = room.players[0].id;
        room.players[0].isHost = true;
        io.to('game-room').emit('chat-message', {
          content: `${room.players[0].name} is now the host.`,
          system: true
        });
      }

      if (room.players.length === 0) {
        // Reset room when all players leave
        resetRoom();
        disconnectedPlayers.clear(); // Clear saved scores when room resets
        console.log('All players left. Room reset.');
      } else {
        io.to('game-room').emit('player-update', room.players);
      }
    }
  });
});

// --- GAME LOGIC ---

function resetRoom() {
  if (room.game.interval) clearInterval(room.game.interval);
  if (room.game.hintTimeouts) room.game.hintTimeouts.forEach(t => clearTimeout(t));

  room = {
    hostId: null,
    status: 'lobby',
    settings: {
      rounds: 3,
      drawTime: 80,
      wordCount: 3,
      hints: 2,
      difficulty: 'easy',
      customWords: '',
      myWordsOnly: false,
      language: 'en'
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
      hintTimeouts: [],
      canvasActions: []
    }
  };
}

function startGame() {
  room.status = 'playing';
  room.game.currentRound = 1;
  room.game.currentDrawerIndex = -1;
  io.to('game-room').emit('game-started');
  startTurn();
}

// Process vote results when timer expires
function processVoteResults() {
  if (!room.game.activeVote) return;

  const vote = room.game.activeVote;
  const votes = Object.values(vote.votes);
  const upVotes = votes.filter(v => v === 'up').length;
  const downVotes = votes.filter(v => v === 'down').length;

  const target = room.players.find(p => p.id === vote.targetId);
  const initiator = room.players.find(p => p.id === vote.initiatorId);

  if (votes.length === 0) {
    // No votes cast
    io.to('game-room').emit('chat-message', {
      content: `🗳️ Vote ended - no votes were cast!`,
      system: true
    });
  } else if (downVotes > upVotes) {
    // Majority voted down - target loses 4000 points
    if (target) {
      const pointsLost = Math.min(4000, target.score);
      target.score = Math.max(0, target.score - 4000);
      io.to('game-room').emit('chat-message', {
        content: `⚠️ Vote passed! ${target.name} loses ${pointsLost} points! (${downVotes} 👎 vs ${upVotes} 👍)`,
        system: true
      });
    }
  } else {
    // Majority voted up or tie - initiator loses 1000 points for failed vote
    if (initiator) {
      const pointsLost = Math.min(1000, initiator.score);
      initiator.score = Math.max(0, initiator.score - 1000);
      io.to('game-room').emit('chat-message', {
        content: `⚠️ Vote failed! ${initiator.name} loses ${pointsLost} points for unsuccessful vote! (${downVotes} 👎 vs ${upVotes} 👍)`,
        system: true
      });
    }
  }

  // Clear active vote and update players
  room.game.activeVote = null;
  io.to('game-room').emit('vote-ended');
  io.to('game-room').emit('player-update', room.players);
}

function startTurn() {
  room.players.forEach(p => p.hasGuessed = false);
  room.game.currentDrawerIndex++;

  // Reset vote state for new turn
  if (room.game.activeVote && room.game.activeVote.timeout) {
    clearTimeout(room.game.activeVote.timeout);
  }
  room.game.activeVote = null;
  room.game.playersWhoInitiatedVote = new Set();
  room.game.lastRoundPoints = {};

  if (room.game.currentDrawerIndex >= room.players.length) {
    room.game.currentRound++;
    room.game.currentDrawerIndex = 0;
    if (room.game.currentRound > room.settings.rounds) {
      endGame();
      return;
    }
  }

  const drawer = room.players[room.game.currentDrawerIndex];
  room.status = 'selecting';
  room.game.wordOptions = getWords(room.settings.wordCount || 3, room.settings);

  io.to('game-room').emit('turn-update', {
    drawerId: drawer.id,
    round: room.game.currentRound,
    totalRounds: room.settings.rounds
  });

  io.to(drawer.id).emit('word-selection', room.game.wordOptions);

  startTimer(15, () => {
    const randomWord = room.game.wordOptions[Math.floor(Math.random() * room.game.wordOptions.length)];
    startDrawingPhase(randomWord);
  });
}

function startDrawingPhase(word) {
  room.status = 'drawing';
  room.game.currentWord = word;
  room.game.revealedIndices = [];
  room.game.canvasActions = [];

  if (room.game.hintTimeouts) room.game.hintTimeouts.forEach(t => clearTimeout(t));
  room.game.hintTimeouts = [];

  io.to('game-room').emit('drawing-phase-start', {
    wordLength: word.length,
    drawTime: room.settings.drawTime
  });

  const drawer = room.players[room.game.currentDrawerIndex];
  io.to(drawer.id).emit('your-word', word);

  const numHints = room.settings.hints || 2;
  const drawTime = room.settings.drawTime;

  for (let i = 1; i <= numHints; i++) {
    const hintTime = Math.floor((drawTime - 5) * (i / (numHints + 1))) * 1000;
    const timeout = setTimeout(() => revealHint(), hintTime);
    room.game.hintTimeouts.push(timeout);
  }

  startTimer(room.settings.drawTime, () => endTurn());
}

function revealHint() {
  const word = room.game.currentWord;
  if (!word) return;

  const availableIndices = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ' && !room.game.revealedIndices.includes(i)) {
      availableIndices.push(i);
    }
  }
  if (availableIndices.length === 0) return;

  const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  room.game.revealedIndices.push(randomIndex);

  let hintDisplay = '';
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ' ') hintDisplay += '  ';
    else if (room.game.revealedIndices.includes(i)) hintDisplay += word[i] + ' ';
    else hintDisplay += '_ ';
  }

  const drawer = room.players[room.game.currentDrawerIndex];
  if (!drawer) return;
  room.players.forEach(p => {
    if (p.id !== drawer.id) io.to(p.id).emit('hint-update', hintDisplay.trim());
  });
}

function endTurn() {
  if (room.game.hintTimeouts) {
    room.game.hintTimeouts.forEach(t => clearTimeout(t));
    room.game.hintTimeouts = [];
  }

  io.to('game-room').emit('turn-end', { word: room.game.currentWord });
  // Wait 8 seconds between turns to allow WiFi clients to reconnect
  startTimer(8, () => startTurn());
}

function endGame() {
  if (room.game.interval) clearInterval(room.game.interval);
  if (room.game.hintTimeouts) room.game.hintTimeouts.forEach(t => clearTimeout(t));
  room.game.hintTimeouts = [];
  room.game.canvasActions = [];

  io.to('game-room').emit('game-ended', { players: room.players });

  // Reset to lobby
  room.status = 'lobby';
  room.game.currentRound = 0;
  room.game.currentDrawerIndex = -1;
  room.game.currentWord = null;
  room.game.timer = 0;
  room.game.wordOptions = [];
  room.game.revealedIndices = [];

  room.players.forEach(p => {
    p.score = 0;
    p.hasGuessed = false;
  });

  console.log('Game ended. Room reset to lobby.');
}

function startTimer(seconds, onComplete) {
  if (room.game.interval) clearInterval(room.game.interval);

  room.game.timer = seconds;
  io.to('game-room').emit('timer-update', room.game.timer);

  room.game.interval = setInterval(() => {
    room.game.timer--;
    io.to('game-room').emit('timer-update', room.game.timer);
    if (room.game.timer <= 0) {
      clearInterval(room.game.interval);
      if (onComplete) onComplete();
    }
  }, 1000);
}

const START_PORT = parseInt(process.env.PORT) || 3000;

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://${LOCAL_IP}:${port}`);
    console.log('Students can join at this URL directly - no room code needed!');
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

// Global error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
});
