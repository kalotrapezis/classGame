import { io } from "socket.io-client";
import './style.css';

// Connect to server with robust reconnection settings for WiFi stability
const serverUrl = window.location.origin;
const socket = io(serverUrl, {
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 30000,
    autoConnect: true
});

console.log(`Connecting to ClassGame server at: ${serverUrl}`);

// --- CONNECTION STATUS HANDLING ---
let wasConnected = false;
let reconnectOverlay = null;

function showReconnectOverlay() {
    if (reconnectOverlay) return;
    reconnectOverlay = document.createElement('div');
    reconnectOverlay.id = 'reconnect-overlay';
    reconnectOverlay.innerHTML = `
        <div class="reconnect-content">
            <div class="reconnect-spinner"></div>
            <h2>Reconnecting...</h2>
            <p>Please wait, connection lost</p>
        </div>
    `;
    document.body.appendChild(reconnectOverlay);
}

function hideReconnectOverlay() {
    if (reconnectOverlay) {
        reconnectOverlay.remove();
        reconnectOverlay = null;
    }
}

socket.on('connect', () => {
    console.log('Connected to server');
    hideReconnectOverlay();

    // Auto-rejoin if we were in the game before
    if (wasConnected && gameState.name) {
        console.log('Reconnected! Auto-rejoining as:', gameState.name);
        socket.emit('join-game', {
            userName: gameState.name,
            avatar: gameState.avatar
        }, (response) => {
            if (response.success) {
                gameState.isHost = response.isHost;
                console.log('Successfully rejoined the game');
            }
        });
    }
    wasConnected = true;
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    if (gameState.screen !== 'landing') {
        showReconnectOverlay();
    }
});

socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnection attempt ${attemptNumber}...`);
});

socket.on('reconnect_failed', () => {
    console.log('Failed to reconnect after all attempts');
    if (reconnectOverlay) {
        reconnectOverlay.querySelector('h2').textContent = 'Connection Failed';
        reconnectOverlay.querySelector('p').textContent = 'Please refresh the page';
    }
});

// --- STATE ---
let gameState = {
    screen: 'landing',
    name: '',
    avatar: { emoji: '😀' },
    isHost: false,
    players: [],
    drawerId: null,
    settings: {
        rounds: 3,
        drawTime: 80,
        wordCount: 3,
        hints: 2,
        difficulty: 'easy',
        customWords: '',
        language: 'en'
    }
};

// --- DOM ELEMENTS ---
const screens = {
    landing: document.getElementById('screen-landing'),
    lobby: document.getElementById('screen-lobby'),
    game: document.getElementById('screen-game'),
    gameover: document.getElementById('screen-gameover')
};

// Landing
const inputName = document.getElementById('input-name');
const btnPlay = document.getElementById('btn-play');
const btnRandomAvatar = document.getElementById('btn-random-avatar');
const avatarPreview = document.getElementById('avatar-preview');

// Lobby
const lobbyInviteLink = document.getElementById('lobby-invite-link');
const btnCopyLink = document.getElementById('btn-copy-invite');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const btnStartGame = document.getElementById('btn-start-game');
const lobbyChatMessages = document.getElementById('lobby-chat-messages');
const lobbyChatInput = document.getElementById('lobby-chat-input');
const serverIpSpan = document.getElementById('server-ip');

// Settings
const settingRounds = document.getElementById('setting-rounds');
const settingDrawTime = document.getElementById('setting-draw-time');
const settingWordCount = document.getElementById('setting-word-count');
const settingCustomWords = document.getElementById('setting-custom-words');
const settingMyWordsOnly = document.getElementById('setting-my-words-only');
const settingHints = document.getElementById('setting-hints');
const settingDifficulty = document.getElementById('setting-difficulty');
const settingLanguage = document.getElementById('setting-language');

// Game
const gamePlayerList = document.getElementById('game-player-list');
const gameChatMessages = document.getElementById('game-chat-messages');
const gameChatInput = document.getElementById('game-chat-input');
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');

// --- INITIALIZATION ---
function init() {
    const savedName = localStorage.getItem('classgame_name');
    if (savedName) inputName.value = savedName;
    renderAvatar();
    initializeColorPalette();
}

function initializeColorPalette() {
    const colors = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
        '#ff00ff', '#00ffff', '#ffa500', '#800080', '#808080', '#a52a2a'
    ];

    const palette = document.getElementById('color-palette');
    colors.forEach((color, i) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        if (i === 0) swatch.classList.add('active');
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;
        swatch.addEventListener('click', () => {
            document.querySelector('.color-swatch.active')?.classList.remove('active');
            swatch.classList.add('active');
            currentColor = color;
            if (currentTool === 'eraser') setActiveTool('pencil');
        });
        palette.appendChild(swatch);
    });
}

// --- NAVIGATION ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
    gameState.screen = screenName;
    if (screenName === 'game') setTimeout(resizeCanvas, 100);
}

// --- AVATAR ---
function renderAvatar() {
    avatarPreview.textContent = gameState.avatar.emoji;
}

function randomizeAvatar() {
    const emojis = ['😀', '😎', '🤓', '😊', '🥳', '🤩', '😇', '🤠', '🥸', '🤡', '👻', '👽', '🤖', '🐶', '🐱', '🐼'];
    gameState.avatar.emoji = emojis[Math.floor(Math.random() * emojis.length)];
    renderAvatar();
}

// --- DRAWING ---
let isDrawing = false;
let lastX = 0, lastY = 0;
let currentTool = 'brush';
let currentColor = '#000000';
let currentSize = 5;
let canvasActions = []; // Store all drawing actions for replay on resize

// --- THROTTLING FOR WIFI OPTIMIZATION (ADAPTIVE) ---
let pendingLines = [];
let throttleTimer = null;
let currentThrottleMs = 80; // Default: safe for WiFi (80ms)
let lastPingTime = 0;
let connectionQuality = 'unknown'; // 'good', 'medium', 'slow', 'unknown'

// Measure connection quality and adapt throttle
function measureConnectionQuality() {
    const start = Date.now();
    socket.emit('ping-check', {}, () => {
        const latency = Date.now() - start;
        lastPingTime = latency;

        // Adaptive throttling based on latency
        if (latency < 50) {
            currentThrottleMs = 50;
            connectionQuality = 'good';
        } else if (latency < 100) {
            currentThrottleMs = 80;
            connectionQuality = 'medium';
        } else if (latency < 200) {
            currentThrottleMs = 120;
            connectionQuality = 'slow';
        } else {
            currentThrottleMs = 150;
            connectionQuality = 'very-slow';
        }

        console.log(`Connection: ${connectionQuality} (${latency}ms latency, throttle: ${currentThrottleMs}ms)`);
    });
}

// Measure on connect and periodically during game
socket.on('connect', () => {
    setTimeout(measureConnectionQuality, 1000); // Measure after 1s
});

// Re-measure every 30 seconds during gameplay
setInterval(() => {
    if (gameState.screen === 'game') {
        measureConnectionQuality();
    }
}, 30000);

function sendPendingLines() {
    if (pendingLines.length === 0) return;

    // Send all pending lines as a batch
    if (pendingLines.length === 1) {
        socket.emit('draw-line', pendingLines[0]);
    } else {
        socket.emit('draw-batch', pendingLines);
    }
    pendingLines = [];
}

function queueLine(lineData) {
    pendingLines.push(lineData);
    canvasActions.push({ type: 'line', data: lineData });

    // Start throttle timer if not already running (uses adaptive interval)
    if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
            sendPendingLines();
            throttleTimer = null;
        }, currentThrottleMs);
    }
}

function startDrawing(e) {
    if (gameState.screen !== 'game') return;
    if (!document.getElementById('canvas-overlay').classList.contains('hidden')) return;
    if (gameState.drawerId !== socket.id) return;

    isDrawing = true;
    [lastX, lastY] = getCoordinates(e);

    if (currentTool === 'fill') {
        floodFill(lastX, lastY, currentColor);
        const fillData = { type: 'fill', x: lastX, y: lastY, color: currentColor };
        canvasActions.push({ type: 'action', data: fillData });
        socket.emit('draw-action', fillData);
        isDrawing = false;
    } else {
        draw(e);
    }
}

function draw(e) {
    if (!isDrawing || gameState.drawerId !== socket.id) {
        isDrawing = false;
        return;
    }

    const [x, y] = getCoordinates(e);
    const color = currentTool === 'eraser' ? '#ffffff' : currentColor;

    drawLine(lastX, lastY, x, y, color, currentSize);
    const lineData = { from: { x: lastX, y: lastY }, to: { x, y }, color, size: currentSize };
    queueLine(lineData); // Use throttled queue instead of direct emit
    [lastX, lastY] = [x, y];
}

function stopDrawing() {
    isDrawing = false;
    // Send any remaining lines immediately when user stops drawing
    if (pendingLines.length > 0) {
        if (throttleTimer) {
            clearTimeout(throttleTimer);
            throttleTimer = null;
        }
        sendPendingLines();
    }
}

function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX, clientY;
    if (e.type.startsWith('touch')) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
}

function drawLine(x1, y1, x2, y2, color, size) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
}

function floodFill(x, y, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width, height = canvas.height;
    const startX = Math.floor(x), startY = Math.floor(y);
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

    const startIdx = (startY * width + startX) * 4;
    const targetR = data[startIdx], targetG = data[startIdx + 1], targetB = data[startIdx + 2], targetA = data[startIdx + 3];
    const fillR = parseInt(fillColor.substr(1, 2), 16);
    const fillG = parseInt(fillColor.substr(3, 2), 16);
    const fillB = parseInt(fillColor.substr(5, 2), 16);

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === 255) return;

    // Helper to check if pixel matches target color
    function matchesTarget(idx) {
        return data[idx] === targetR && data[idx + 1] === targetG &&
            data[idx + 2] === targetB && data[idx + 3] === targetA;
    }

    const stack = [[startX, startY]];
    let iterations = 0;
    const maxIterations = width * height;

    while (stack.length > 0 && iterations < maxIterations) {
        iterations++;
        const [px, py] = stack.pop();

        // Skip if out of bounds
        if (px < 0 || px >= width || py < 0 || py >= height) continue;

        let idx = (py * width + px) * 4;
        if (!matchesTarget(idx)) continue;

        // Scan left
        let left = px;
        while (left > 0 && matchesTarget((py * width + left - 1) * 4)) {
            left--;
        }

        // Scan right and fill
        let right = left;
        while (right < width && matchesTarget((py * width + right) * 4)) {
            const i = (py * width + right) * 4;
            data[i] = fillR; data[i + 1] = fillG; data[i + 2] = fillB; data[i + 3] = 255;
            right++;
        }

        // Add pixels above and below to stack
        for (let scanX = left; scanX < right; scanX++) {
            if (py > 0 && matchesTarget(((py - 1) * width + scanX) * 4)) {
                stack.push([scanX, py - 1]);
            }
            if (py < height - 1 && matchesTarget(((py + 1) * width + scanX) * 4)) {
                stack.push([scanX, py + 1]);
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasActions = [];
}

function replayCanvasActions() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasActions.forEach(item => {
        if (item.type === 'line') {
            const d = item.data;
            drawLine(d.from.x, d.from.y, d.to.x, d.to.y, d.color, d.size);
        } else if (item.type === 'action') {
            if (item.data.type === 'fill') {
                floodFill(item.data.x, item.data.y, item.data.color);
            }
        }
    });
}

// Fixed canvas resolution for consistency across all clients
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function resizeCanvas() {
    // Use fixed resolution - CSS handles the visual scaling
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Replay all actions at fixed resolution
    replayCanvasActions();
}
window.addEventListener('resize', resizeCanvas);

// --- EVENT LISTENERS ---
btnRandomAvatar.addEventListener('click', randomizeAvatar);

document.querySelectorAll('.emoji-option').forEach(btn => {
    btn.addEventListener('click', () => {
        gameState.avatar.emoji = btn.dataset.emoji;
        renderAvatar();
    });
});

btnPlay.addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) return alert("Please enter a name!");
    gameState.name = name;
    localStorage.setItem('classgame_name', name);
    joinGame();
});

btnCopyLink.addEventListener('click', () => {
    const link = lobbyInviteLink.textContent;
    navigator.clipboard.writeText(link).then(() => {
        btnCopyLink.textContent = 'Copied!';
        setTimeout(() => btnCopyLink.textContent = 'Copy', 2000);
    });
});

lobbyChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat(lobbyChatInput.value, 'lobby');
});
gameChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat(gameChatInput.value, 'game');
});

[settingRounds, settingDrawTime, settingWordCount, settingCustomWords, settingMyWordsOnly, settingHints, settingDifficulty, settingLanguage].forEach(input => {
    input.addEventListener('change', () => {
        if (gameState.isHost) updateSettings();
    });
});

btnStartGame.addEventListener('click', () => {
    socket.emit('start-game');
});

function setActiveTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tool-${tool}`)?.classList.add('active');
}

document.getElementById('tool-pencil').addEventListener('click', () => setActiveTool('pencil'));
document.getElementById('tool-eraser').addEventListener('click', () => setActiveTool('eraser'));
document.getElementById('tool-fill').addEventListener('click', () => setActiveTool('fill'));
document.getElementById('tool-clear').addEventListener('click', () => {
    clearCanvas();
    socket.emit('draw-action', { type: 'clear' });
});

document.querySelectorAll('.brush-size').forEach(sizeBtn => {
    sizeBtn.addEventListener('click', () => {
        document.querySelector('.brush-size.active')?.classList.remove('active');
        sizeBtn.classList.add('active');
        currentSize = parseInt(sizeBtn.dataset.size);
    });
});

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
canvas.addEventListener('touchend', stopDrawing);

// --- VOTING SYSTEM ---
let voteTimerInterval = null;

// Vote modal button handlers
document.getElementById('btn-vote-up').addEventListener('click', () => {
    socket.emit('cast-vote', { vote: 'up' });
    document.getElementById('btn-vote-up').disabled = true;
    document.getElementById('btn-vote-down').disabled = true;
});

document.getElementById('btn-vote-down').addEventListener('click', () => {
    socket.emit('cast-vote', { vote: 'down' });
    document.getElementById('btn-vote-up').disabled = true;
    document.getElementById('btn-vote-down').disabled = true;
});

// Vote started - show modal
socket.on('vote-started', (data) => {
    const modal = document.getElementById('vote-modal');
    document.getElementById('vote-target-name').textContent = data.targetName;
    document.getElementById('vote-up-count').textContent = '0';
    document.getElementById('vote-down-count').textContent = '0';
    document.getElementById('btn-vote-up').disabled = false;
    document.getElementById('btn-vote-down').disabled = false;
    modal.classList.remove('hidden');

    // Start countdown timer
    let timeLeft = 20;
    document.getElementById('vote-timer').textContent = timeLeft;
    if (voteTimerInterval) clearInterval(voteTimerInterval);
    voteTimerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('vote-timer').textContent = timeLeft;
        if (timeLeft <= 0) clearInterval(voteTimerInterval);
    }, 1000);
});

// Vote update - update counts
socket.on('vote-update', (data) => {
    document.getElementById('vote-up-count').textContent = data.upVotes || 0;
    document.getElementById('vote-down-count').textContent = data.downVotes || 0;
});

// Vote ended - hide modal
socket.on('vote-ended', () => {
    document.getElementById('vote-modal').classList.add('hidden');
    if (voteTimerInterval) clearInterval(voteTimerInterval);
});

// --- SOCKET ACTIONS ---
function joinGame() {
    socket.emit('join-game', {
        userName: gameState.name,
        avatar: gameState.avatar
    }, (response) => {
        if (response.success) {
            gameState.isHost = response.isHost;
            gameState.settings = response.settings;
            if (!response.isLateJoiner) {
                enterLobby();
            }
        } else {
            alert(response.message);
        }
    });
}

function enterLobby() {
    showScreen('lobby');
    renderPlayerList();

    socket.emit('get-server-info', {}, (info) => {
        serverIpSpan.textContent = info.ip + ':' + info.port;
        // Simple URL - no room code needed!
        lobbyInviteLink.textContent = `http://${info.ip}:${info.port}`;
    });

    if (gameState.isHost) {
        [settingRounds, settingDrawTime, settingWordCount, settingCustomWords, settingMyWordsOnly, settingHints, settingDifficulty, settingLanguage].forEach(el => el.disabled = false);
        btnStartGame.classList.remove('hidden');
    }
}

function updateSettings() {
    const settings = {
        rounds: parseInt(settingRounds.value),
        drawTime: parseInt(settingDrawTime.value),
        wordCount: parseInt(settingWordCount.value),
        hints: parseInt(settingHints.value),
        difficulty: settingDifficulty.value,
        customWords: settingCustomWords.value,
        myWordsOnly: settingMyWordsOnly.checked,
        language: settingLanguage.value
    };
    socket.emit('update-settings', { settings });
}

function sendChat(message, context) {
    if (!message.trim()) return;
    socket.emit('send-chat', { message });
    if (context === 'lobby') lobbyChatInput.value = '';
    if (context === 'game') gameChatInput.value = '';
}

// --- SOCKET LISTENERS ---
socket.on('player-update', (players) => {
    gameState.players = players;
    renderPlayerList();
});

socket.on('game-sync', (syncData) => {
    console.log('Late joiner sync:', syncData);
    gameState.players = syncData.players;
    gameState.drawerId = syncData.drawerId;

    showScreen('game');
    document.getElementById('current-round').textContent = syncData.round;
    document.getElementById('total-rounds').textContent = syncData.totalRounds;
    document.getElementById('timer').textContent = syncData.timer;

    if (syncData.wordLength > 0) {
        document.getElementById('word-display').textContent = new Array(syncData.wordLength).fill('_').join(' ');
    }

    const toolbar = document.querySelector('.toolbar');
    if (toolbar) toolbar.style.display = 'none';

    const overlay = document.getElementById('canvas-overlay');
    if (syncData.status === 'drawing') {
        overlay.classList.add('hidden');
        setTimeout(() => {
            resizeCanvas();
            if (syncData.canvasActions) {
                syncData.canvasActions.forEach(item => {
                    if (item.type === 'line') {
                        const d = item.data;
                        drawLine(d.from.x, d.from.y, d.to.x, d.to.y, d.color, d.size);
                    } else if (item.type === 'action') {
                        if (item.data.type === 'clear') clearCanvas();
                        if (item.data.type === 'fill') floodFill(item.data.x, item.data.y, item.data.color);
                    }
                });
            }
        }, 150);
    } else {
        const drawer = gameState.players.find(p => p.id === syncData.drawerId);
        document.getElementById('overlay-message').textContent = `${drawer ? drawer.name : 'Someone'} is choosing a word...`;
        overlay.classList.remove('hidden');
    }

    renderPlayerList();
    gameChatMessages.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'chat-message system';
    div.textContent = 'You joined mid-game! Guess now, draw next round.';
    gameChatMessages.appendChild(div);
});

socket.on('settings-update', (settings) => {
    gameState.settings = settings;
    settingRounds.value = settings.rounds;
    settingDrawTime.value = settings.drawTime;
    settingWordCount.value = settings.wordCount;
    settingHints.value = settings.hints || 2;
    settingDifficulty.value = settings.difficulty || 'easy';
    settingLanguage.value = settings.language || 'en';
    settingCustomWords.value = settings.customWords;
    settingMyWordsOnly.checked = settings.myWordsOnly || false;
});

socket.on('hint-update', (hintDisplay) => {
    document.getElementById('word-display').textContent = hintDisplay;
});

socket.on('chat-message', (msg) => {
    const div = document.createElement('div');
    div.className = 'chat-message';
    if (msg.system) div.classList.add('system');
    if (msg.isCorrect) div.classList.add('correct-guess');
    div.innerHTML = msg.system ? msg.content : `<b>${escapeHtml(msg.sender)}:</b> ${escapeHtml(msg.content)}`;

    if (gameState.screen === 'lobby') {
        lobbyChatMessages.appendChild(div);
        lobbyChatMessages.scrollTop = lobbyChatMessages.scrollHeight;
    } else {
        gameChatMessages.appendChild(div);
        gameChatMessages.scrollTop = gameChatMessages.scrollHeight;
    }
});

socket.on('game-started', () => showScreen('game'));

socket.on('timer-update', (time) => {
    document.getElementById('timer').textContent = time;
});

socket.on('turn-update', (data) => {
    document.getElementById('current-round').textContent = data.round;
    document.getElementById('total-rounds').textContent = data.totalRounds;
    gameState.drawerId = data.drawerId;
    renderPlayerList();

    const isMe = data.drawerId === socket.id;
    const toolbar = document.querySelector('.toolbar');

    if (isMe) {
        if (toolbar) toolbar.style.display = 'flex';
        document.getElementById('overlay-message').textContent = "Choose a word!";
        document.getElementById('canvas-overlay').classList.remove('hidden');
    } else {
        if (toolbar) toolbar.style.display = 'none';
        const drawer = gameState.players.find(p => p.id === data.drawerId);
        document.getElementById('overlay-message').textContent = `${drawer ? drawer.name : 'Someone'} is choosing a word...`;
        document.getElementById('canvas-overlay').classList.remove('hidden');
    }
});

socket.on('word-selection', (words) => {
    const overlay = document.getElementById('canvas-overlay');
    overlay.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
            <h2 style="color: white; margin: 0;">Choose a word</h2>
            <div class="word-choices">
                ${words.map(w => `<button class="btn-word">${w}</button>`).join('')}
            </div>
        </div>
    `;
    overlay.classList.remove('hidden');

    overlay.querySelectorAll('.btn-word').forEach(btn => {
        btn.addEventListener('click', () => {
            socket.emit('select-word', { word: btn.textContent });
            overlay.classList.add('hidden');
        });
    });
});

socket.on('drawing-phase-start', (data) => {
    document.getElementById('canvas-overlay').classList.add('hidden');
    clearCanvas();
    document.getElementById('word-display').textContent = new Array(data.wordLength).fill('_').join(' ');

    const isDrawer = gameState.drawerId === socket.id;
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) toolbar.style.display = isDrawer ? 'flex' : 'none';
});

socket.on('your-word', (word) => {
    document.getElementById('word-display').textContent = word;
});

socket.on('turn-end', (data) => {
    document.getElementById('overlay-message').textContent = `The word was: ${data.word}`;
    document.getElementById('canvas-overlay').classList.remove('hidden');
});

socket.on('game-ended', (data) => {
    const sorted = [...data.players].sort((a, b) => b.score - a.score);

    for (let i = 0; i < 3; i++) {
        const player = sorted[i];
        const place = i + 1;
        if (player) {
            document.getElementById(`winner-${place}-avatar`).textContent = player.avatar?.emoji || '😀';
            document.getElementById(`winner-${place}-name`).textContent = player.name;
            document.getElementById(`winner-${place}-score`).textContent = `${player.score} pts`;
        } else {
            document.getElementById(`winner-${place}-avatar`).textContent = '❓';
            document.getElementById(`winner-${place}-name`).textContent = '-';
            document.getElementById(`winner-${place}-score`).textContent = '0 pts';
        }
    }

    showScreen('gameover');
});

document.getElementById('btn-play-again').addEventListener('click', () => showScreen('lobby'));

socket.on('draw-line', (data) => {
    drawLine(data.from.x, data.from.y, data.to.x, data.to.y, data.color, data.size);
    canvasActions.push({ type: 'line', data });
});

// Handle batched drawing for WiFi optimization
socket.on('draw-batch', (lines) => {
    lines.forEach(data => {
        drawLine(data.from.x, data.from.y, data.to.x, data.to.y, data.color, data.size);
        canvasActions.push({ type: 'line', data });
    });
});

socket.on('draw-action', (data) => {
    if (data.type === 'clear') {
        clearCanvas();
    } else if (data.type === 'fill') {
        floodFill(data.x, data.y, data.color);
        canvasActions.push({ type: 'action', data });
    }
});

// --- HELPERS ---
function renderPlayerList() {
    const list = gameState.screen === 'lobby' ? lobbyPlayerList : gamePlayerList;
    lobbyPlayerCount.textContent = gameState.players.length;

    list.innerHTML = '';
    gameState.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item';
        if (p.id === socket.id) div.classList.add('is-me');
        if (p.hasGuessed) div.classList.add('has-guessed');

        const isDrawer = gameState.drawerId === p.id;
        const isMe = p.id === socket.id;
        const showVoteIcon = gameState.screen === 'game' && !isMe;

        div.innerHTML = `
            <div class="player-avatar-small">${p.avatar?.emoji || '😀'}</div>
            <div class="player-info">
                <span class="player-name">${escapeHtml(p.name)} ${p.isHost ? '👑' : ''} ${isDrawer ? '✏️' : ''}</span>
                <span class="player-score">Points: ${p.score || 0}</span>
            </div>
            ${showVoteIcon ? `<button class="btn-vote-player" data-player-id="${p.id}" title="Start vote against ${escapeHtml(p.name)}">🗳️</button>` : ''}
        `;
        list.appendChild(div);
    });

    // Add click handlers for vote icons
    if (gameState.screen === 'game') {
        list.querySelectorAll('.btn-vote-player').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.playerId;
                socket.emit('start-vote', { targetId });
            });
        });
    }
}

function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

init();
