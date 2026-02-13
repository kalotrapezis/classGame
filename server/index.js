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
  const virtualKeywords = ['virtual', 'vmware', 'vbox', 'hyperv', 'vethernet', 'wsl', 'loopback'];
  let fallbackIP = null;

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    const isVirtual = virtualKeywords.some(keyword => lowerName.includes(keyword));

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) {
          return iface.address;
        } else if (!fallbackIP) {
          fallbackIP = iface.address;
        }
      }
    }
  }
  return fallbackIP || 'localhost';
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
console.log('TEST_MODE:', process.env.TEST_MODE);
const CONNECTION_RATE_LIMIT_MS = (process.env.TEST_MODE === 'true' || process.env.TEST_MODE === true) ? 0 : 100;

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
  "umbrella", "violin", "watermelon", "xylophone", "yacht", "zebra", "airplane", "ball", "cat", "door",
  "desk", "blackboard", "sharpener", "compass", "sketchbook", "bicycle", "scooter", "hide and seek", "marbles", "chess",
  "excursion", "break", "bag", "pencil case", "jump rope", "keyboard", "mouse", "monitor", "printer", "robot",
  "cable", "usb", "internet", "password", "algorithm", "program", "email", "tablet", "laptop", "microphone",
  "zeus", "hercules", "centaur", "olympus", "pegasus", "minotaur", "chimera", "poseidon", "athena", "achilles",
  "trojan horse", "kolokotronis", "bouboulina", "tsarouchi", "foustanela", "banner", "secret school", "karaiskakis", "kanaris", "souli",
  "mesolongi", "blue bin", "composting", "glass", "paper", "aluminum", "plastic", "batteries", "environment", "ecology",
  "mercury", "venus", "earth", "mars", "saturn", "uranus", "comet", "asteroid", "pomegranate", "fig",
  "cherry", "pear", "broccoli", "eggplant", "zucchini", "okra", "moussaka", "pastitsio", "bean soup", "stuffed vegetables",
  "souvlaki", "strawberry", "tomato", "paris", "london", "rome", "athens", "constantinople", "eiffel tower", "parthenon",
  "colosseum", "big ben", "pyramides", "great wall of china", "mountain", "waterfall", "forest", "island", "volcano", "ocean",
  "thunder", "lightning", "rainbow", "hurricane", "blizzard", "foggy", "greenhouse", "pollution", "solar power", "wildlife",
  "habitat", "software", "database", "wireless", "camera", "experiment", "microscope", "gravity", "oxygen", "molecule",
  "telescope", "astronaut", "galaxy", "satellite", "orbit", "spaceship", "brave", "creative", "honest", "patient",
  "generous", "grumpy", "scientist", "architect", "journalist", "pilot", "engineer", "musician", "excited", "confused",
  "nervous", "exhausted", "proud", "helicopter", "submarine", "railway", "backpack", "map", "passport", "destination",
  "souvenir", "microwave", "wardrobe", "mirror", "balcony", "fireplace", "century", "calendar", "memory", "dream",
  "knowledge", "adventure"
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
  "τρέξιμο", "περπάτημα", "γέλιο", "κλάμα", "φιλί", "αγκαλιά", "δώρο", "χρήματα",
  "θρανίο", "μαυροπίνακας", "ξύστρα", "διαβήτης", "μπλοκ ζωγραφικής", "πατίνι", "κρυφτό", "βόλοι", "σκάκι", "εκδρομή",
  "διάλειμμα", "τσάντα", "κασετίνα", "σχοινάκι", "πληκτρολόγιο", "ποντίκι", "οθόνη", "εκτυπωτής", "ρομπότ", "καλώδιο",
  "usb", "διαδίκτυο", "κωδικός", "αλγόριθμος", "πρόγραμμα", "email", "tablet", "laptop", "μικρόφωνο", "δίας",
  "ηρακλής", "κένταυρος", "όλυμπος", "πήγασος", "μινώταυρος", "χίμαιρα", "ποσειδώνας", "αθηνά", "αχιλλέας", "δούρειος ίππος",
  "κολοκοτρώνης", "μπουμπουλίνα", "τσαρούχι", "φουστανέλα", "λάβαρο", "κρυφό σχολειό", "καραϊσκάκης", "κανάρης", "σούλι", "μεσολόγγι",
  "μπλε κάδος", "κομποστοποίηση", "αλουμίνιο", "πλαστικό", "μπαταρίες", "περιβάλλον", "οικολογία", "ερμής", "αφροδίτη", "γη",
  "άρης", "κρόνος", "ουρανός", "κομήτης", "αστεροειδής", "ρόδι", "σύκο", "κεράσι", "καρπούζι", "αχλάδι",
  "μπρόκολο", "μελιτζάνα", "κολοκύθι", "μπάμια", "μουσακάς", "παστίτσιο", "φασολάδα", "γεμιστά", "σουβλάκι", "φράουλα",
  "ντομάτα", "παρίσι", "λονδίνο", "ρώμη", "αθήνα", "κωνσταντινούπολη", "πύργος του άιφελ", "παρθενώνας", "κολοσσαίο", "μπιγκ μπεν",
  "πυραμίδες", "σινικό τείχος", "καταρράκτης", "δάσος", "νησί", "ηφαίστειο", "ωκεανός", "βροντή", "ουράνιο τόξο", "τυφώνας",
  "χιονοθύελλα", "ομίχλη", "θερμοκήπιο", "μόλυνση", "ηλιακή ενέργεια", "άγρια ζωή", "βιότοπος", "λογισμικό", "βάση δεδομένων", "ασύρματο",
  "κάμερα", "πείραμα", "μικροσκόπιο", "βαρύτητα", "οξυγόνο", "μόριο", "τηλεσκόπιο", "αστροναύτης", "γαλαξίας", "δορυφόρος",
  "τροχιά", "διαστημόπλοιο", "γενναίος", "δημιουργικός", "ειλικρινής", "υπομονετικός", "γενναιόδωρος", "γκρινιάρης", "επιστήμονας", "αρχιτέκτονας",
  "δημοσιογράφος", "πιλότος", "μηχανικός", "μουσικός", "ενθουσιασμένος", "μπερδεμένος", "νευρικός", "εξαντλημένος", "περήφανος", "ελικόπτερο",
  "υποβρύχιο", "σιδηρόδρομος", "σακίδιο", "πυξίδα", "χάρτης", "διαβατήριο", "προορισμός", "σουβενίρ", "φούρνος μικροκυμάτων", "ντουλάπα",
  "καθρέφτης", "μπαλκόνι", "τζάκι", "αιώνας", "ημερολόγιο", "μνήμη", "όνειρο", "γνώση", "περιπέτεια"
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
    currentDrawerId: null,
    currentWord: null,
    timer: 0,
    interval: null,
    wordOptions: [],
    revealedIndices: [],
    hintTimeouts: [],
    canvasActions: [],
    activeVote: null,  // { targetId, targetName, initiatorId, votes: {playerId: 'up'|'down'}, timeout }
    playersWhoInitiatedVote: new Set(),  // Track who initiated vote this round
    lastRoundPoints: {},
    lastVoteEndTime: 0,  // Timestamp when last vote ended (for cooldown)
    playerVoteCounts: {},  // { playerId: totalVotesInitiated } - remove voting after 3
    voteCooldownActive: false,  // Track if cooldown is active
    playersWhoHaveDrawnThisRound: new Set()  // Track who has drawn in current round
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

  // SKIP RATE LIMITING IN TEST MODE
  if (!process.env.TEST_MODE) {
    const lastTime = lastConnectionTime.get(clientIP);
    if (lastTime && (now - lastTime) < CONNECTION_RATE_LIMIT_MS) {
      console.log(`Rate limiting connection from ${clientIP}`);
      socket.disconnect(true);
      return;
    }
    lastConnectionTime.set(clientIP, now);
  }

  if (lastConnectionTime.size > 1000) {
    const cutoff = now - 60000;
    for (const [ip, time] of lastConnectionTime.entries()) {
      if (time < cutoff) lastConnectionTime.delete(ip);
    }
  }

  console.log('User connected:', socket.id, 'from', clientIP);

  // --- JOIN GAME (single room, no room ID needed) ---
  socket.on('join-game', ({ userName, avatar }, callback) => {
    // Remove any existing player with the same socket.id (handles name change without disconnect)
    const existingIndex = room.players.findIndex(p => p.id === socket.id);
    if (existingIndex !== -1) {
      const existingPlayer = room.players[existingIndex];
      console.log(`Removing existing player entry for socket ${socket.id} (was: ${existingPlayer.name})`);
      room.players.splice(existingIndex, 1);
    }

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
      const drawer = room.players.find(p => p.id === room.game.currentDrawerId);
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
      const isDrawer = room.game.currentDrawerId === socket.id;

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
        const drawer = room.players.find(p => p.id === room.game.currentDrawerId);
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

        const guessers = room.players.filter(p => p.id !== room.game.currentDrawerId);
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
    const minPlayers = process.env.TEST_MODE ? 1 : 2;
    if (room.hostId !== socket.id) {
      return;
    }
    if (room.players.length < minPlayers) {
      socket.emit('chat-message', { system: true, content: `Need at least ${minPlayers} player${minPlayers === 1 ? '' : 's'} to start the game!` });
      return;
    }
    startGame();
  });

  socket.on('select-word', ({ word }) => {
    if (room.status !== 'selecting') return;
    if (room.game.currentDrawerId !== socket.id) return;
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

  // Force restart game - host only - preserves player data but resets all game state
  socket.on('force-restart-game', () => {
    // Only host can restart
    if (room.hostId !== socket.id) {
      socket.emit('chat-message', { content: 'Only the host can restart the game!', system: true });
      return;
    }

    console.log('Host triggered force restart - preserving player data');

    // Clear all timers
    if (room.game.interval) clearInterval(room.game.interval);
    if (room.game.hintTimeouts) room.game.hintTimeouts.forEach(t => clearTimeout(t));
    if (room.game.activeVote && room.game.activeVote.timeout) {
      clearTimeout(room.game.activeVote.timeout);
    }

    // Preserve player data but reset their game state
    const preservedPlayers = room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,  // Keep scores!
      isHost: p.isHost,
      hasGuessed: false
    }));

    // Reset game state completely
    room.status = 'lobby';
    room.players = preservedPlayers;
    room.game = {
      currentRound: 0,
      currentDrawerId: null,
      currentWord: null,
      timer: 0,
      interval: null,
      wordOptions: [],
      revealedIndices: [],
      hintTimeouts: [],
      canvasActions: [],
      activeVote: null,
      playersWhoInitiatedVote: new Set(),
      lastRoundPoints: {},
      lastVoteEndTime: 0,
      playerVoteCounts: {},  // Reset vote counts on restart
      voteCooldownActive: false,
      playersWhoHaveDrawnThisRound: new Set()
    };

    // Notify all clients to return to lobby
    io.to('game-room').emit('force-restart');
    io.to('game-room').emit('player-update', room.players);
    io.to('game-room').emit('chat-message', {
      content: '🔄 Game restarted by host! Returning to lobby.',
      system: true
    });

    console.log('Game force restarted - players preserved:', preservedPlayers.map(p => p.name));
  });

  // --- HOSTING & DISCOVERY ---

  socket.on('start-hosting', () => {
    console.log(`Socket ${socket.id} started hosting`);
    const address = server.address();
    const port = address ? address.port : START_PORT;
    // Ensure discovery is ready (idempotent if already initialized)
    if (!networkDiscovery.port) {
      networkDiscovery.initialize(port, () => []);
    }
    networkDiscovery.startBroadcasting();
    socket.emit('hosting-started', { ip: LOCAL_IP, port: port });
  });

  socket.on('stop-hosting', () => {
    console.log(`Socket ${socket.id} stopped hosting`);
    networkDiscovery.stopBroadcasting();
  });

  socket.on('find-servers', () => {
    console.log(`Socket ${socket.id} searching for servers`);

    // Immediate response with local IP for manual entry reference
    socket.emit('local-ip-info', { ip: LOCAL_IP });

    const browser = networkDiscovery.findServers(
      (serverInfo) => socket.emit('server-found', serverInfo),
      (serverInfo) => socket.emit('server-lost', serverInfo)
    );

    // Stop searching after 10 seconds to save resources
    setTimeout(() => {
      if (browser) browser.stop();
    }, 10000);
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

    // Check if vote cooldown is active (5 seconds after last vote ended)
    if (room.game.voteCooldownActive) {
      socket.emit('chat-message', { content: 'Please wait - vote cooldown active!', system: true });
      return;
    }

    // Check if this player already initiated a vote this round
    if (room.game.playersWhoInitiatedVote.has(socket.id)) {
      socket.emit('chat-message', { content: 'You already initiated a vote this round!', system: true });
      return;
    }

    // Check if this player has exceeded 3 total votes (remove voting capability)
    const currentVoteCount = room.game.playerVoteCounts[socket.id] || 0;
    if (currentVoteCount >= 3) {
      socket.emit('chat-message', { content: 'You have lost voting privileges (3 votes used)!', system: true });
      return;
    }

    // Increment vote count for this player
    room.game.playerVoteCounts[socket.id] = currentVoteCount + 1;

    // Mark this player as having initiated a vote this round
    room.game.playersWhoInitiatedVote.add(socket.id);

    // Start the vote session
    room.game.activeVote = {
      targetId,
      targetName: target.name,
      initiatorId: socket.id,
      initiatorName: initiator.name,
      votes: {}  // playerId -> 'up' | 'down'
    };

    // Notify clients that voting is now disabled (active vote)
    io.to('game-room').emit('vote-buttons-state', { disabled: true, reason: 'active' });

    io.to('game-room').emit('vote-started', {
      targetId,
      targetName: target.name,
      initiatorName: initiator.name
    });

    io.to('game-room').emit('chat-message', {
      content: `🗳️ ${initiator.name} started a vote against ${target.name}! Vote now (20 sec)`,
      system: true
    });

    // Check if initiator has hit 3 votes - notify them
    if (room.game.playerVoteCounts[socket.id] >= 3) {
      socket.emit('vote-capability-removed');
      socket.emit('chat-message', { content: '⚠️ You have used all 3 votes and can no longer initiate votes.', system: true });
    }

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
      const wasDrawer = room.game.currentDrawerId === socket.id;
      const wasInActiveRound = room.status === 'drawing' || room.status === 'selecting';

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

        // If the drawer left during an active round, end turn and start new one
        if (wasDrawer && wasInActiveRound && room.players.length >= 2) {
          console.log('Drawer left during active round - skipping to next turn');
          io.to('game-room').emit('chat-message', {
            content: '✏️ Drawer left! Skipping to next turn...',
            system: true
          });

          // Clear current turn state
          if (room.game.interval) clearInterval(room.game.interval);
          if (room.game.hintTimeouts) room.game.hintTimeouts.forEach(t => clearTimeout(t));
          room.game.hintTimeouts = [];
          room.game.currentWord = null;
          room.game.canvasActions = [];

          // Emit turn end with no word (since drawer left)
          io.to('game-room').emit('turn-end', { word: '(drawer left)' });

          // Start next turn after brief delay
          setTimeout(() => {
            if (room.players.length >= 2) {
              startTurn();
            }
          }, 3000);
        } else if (wasDrawer && wasInActiveRound && room.players.length < 2) {
          // Not enough players to continue
          console.log('Drawer left and not enough players - ending game');
          endGame();
        }
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
      currentDrawerId: null,
      currentWord: null,
      timer: 0,
      interval: null,
      wordOptions: [],
      revealedIndices: [],
      hintTimeouts: [],
      canvasActions: [],
      playersWhoHaveDrawnThisRound: new Set(),
      playerVoteCounts: {},            // Initialize to prevent TypeError
      playersWhoInitiatedVote: new Set(), // Initialize to prevent TypeError
      voteCooldownActive: false        // Initialize for consistency
    }
  };
}

function startGame() {
  room.status = 'playing';
  room.game.currentRound = 1;
  room.game.currentDrawerId = null;
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

  // Start 5 second cooldown before next vote can be initiated
  room.game.voteCooldownActive = true;
  room.game.lastVoteEndTime = Date.now();
  io.to('game-room').emit('vote-buttons-state', { disabled: true, reason: 'cooldown' });

  setTimeout(() => {
    room.game.voteCooldownActive = false;
    io.to('game-room').emit('vote-buttons-state', { disabled: false });
  }, 5000);
}

function startTurn() {
  room.players.forEach(p => p.hasGuessed = false);

  // Reset vote state for new turn
  if (room.game.activeVote && room.game.activeVote.timeout) {
    clearTimeout(room.game.activeVote.timeout);
  }
  room.game.activeVote = null;
  room.game.playersWhoInitiatedVote = new Set();
  room.game.lastRoundPoints = {};

  // Find next player who hasn't drawn this round
  // Get current drawer's index (or -1 if none)
  let currentIndex = room.game.currentDrawerId
    ? room.players.findIndex(p => p.id === room.game.currentDrawerId)
    : -1;

  let foundDrawer = false;
  let checkedCount = 0;

  while (!foundDrawer && checkedCount < room.players.length) {
    currentIndex++;

    if (currentIndex >= room.players.length) {
      currentIndex = 0;
    }

    const potentialDrawer = room.players[currentIndex];
    if (!potentialDrawer) break;

    // Check if this player has already drawn this round
    if (!room.game.playersWhoHaveDrawnThisRound.has(potentialDrawer.id)) {
      foundDrawer = true;
      room.game.currentDrawerId = potentialDrawer.id;
    }

    checkedCount++;
  }

  // If everyone has drawn, start new round
  if (!foundDrawer || room.game.playersWhoHaveDrawnThisRound.size >= room.players.length) {
    room.game.currentRound++;
    room.game.playersWhoHaveDrawnThisRound = new Set();

    if (room.game.currentRound > room.settings.rounds) {
      endGame();
      return;
    }

    // Continue rotation: find next player after last drawer
    let lastDrawerIndex = room.game.currentDrawerId
      ? room.players.findIndex(p => p.id === room.game.currentDrawerId)
      : -1;

    let nextIndex = (lastDrawerIndex + 1) % room.players.length;
    if (room.players.length > 0) {
      room.game.currentDrawerId = room.players[nextIndex].id;
    }
  }

  const drawer = room.players.find(p => p.id === room.game.currentDrawerId);
  if (!drawer) {
    console.error('No drawer found!');
    return;
  }

  // Mark this player as having drawn this round
  room.game.playersWhoHaveDrawnThisRound.add(drawer.id);

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

  const drawer = room.players.find(p => p.id === room.game.currentDrawerId);
  if (drawer) {
    io.to(drawer.id).emit('your-word', word);
  }

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

  const drawer = room.players.find(p => p.id === room.game.currentDrawerId);
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
  const delay = process.env.TEST_MODE ? 0 : 8;
  startTimer(delay, () => startTurn());
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
  room.game.currentDrawerId = null;
  room.game.currentWord = null;
  room.game.timer = 0;
  room.game.wordOptions = [];
  room.game.revealedIndices = [];
  room.game.playerVoteCounts = {};  // Reset vote counts for new game

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

  const intervalMs = process.env.TEST_MODE ? 50 : 1000;
  room.game.interval = setInterval(() => {
    room.game.timer--;
    io.to('game-room').emit('timer-update', room.game.timer);
    if (room.game.timer <= 0) {
      clearInterval(room.game.interval);
      if (onComplete) onComplete();
    }
  }, intervalMs);
}

const START_PORT = parseInt(process.env.PORT) || 3001;
let serverInstance;

function startServer(port) {
  return new Promise((resolve, reject) => {
    serverInstance = server.listen(port, () => {
      const actualPort = server.address().port;
      console.log(`Server running on http://${LOCAL_IP}:${actualPort}`);

      // Initialize Discovery with the actual port
      networkDiscovery.initialize(actualPort, () => {
        return [{
          id: 'main',
          name: 'ClassGame', // Simple name for now
          count: room.players.length
        }];
      });

      console.log('Students can join at this URL directly - no room code needed!');
      resolve(actualPort);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is busy, trying ${port + 1}...`);
        // Recursive call needs to propagate the promise
        startServer(port + 1).then(resolve).catch(reject);
      } else {
        console.error('Server error:', err);
        reject(err);
      }
    });
  });
}

function stopServer() {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      serverInstance.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Only auto-start if run directly (not imported)
if (require.main === module) {
  startServer(START_PORT);
}

// Global error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
});

module.exports = { startServer, stopServer, app, server };
