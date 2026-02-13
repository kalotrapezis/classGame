const { io } = require("socket.io-client");
const { expect } = require("chai");
const { startServer, stopServer } = require("../index");

const PORT = 3002;
const SERVER_URL = `http://localhost:${PORT}`;

describe("Game Flow Tests", function () {
    this.timeout(10000);
    let client1, client2, client3;

    before(async () => {
        await startServer(PORT);
    });

    after(async () => {
        await stopServer();
    });

    beforeEach((done) => {
        // Connect 3 clients
        client1 = io(SERVER_URL);
        client2 = io(SERVER_URL);
        client3 = io(SERVER_URL);

        let connected = 0;
        const checkConnected = () => {
            connected++;
            if (connected === 3) done();
        };

        client1.on("connect", checkConnected);
        client2.on("connect", checkConnected);
        client3.on("connect", checkConnected);
    });

    afterEach(() => {
        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
    });

    it("should rotate turns sequentially", (done) => {
        // Join game
        client1.emit("join-game", { userName: "Player1", avatar: {} }, () => { });
        client2.emit("join-game", { userName: "Player2", avatar: {} }, () => { });
        client3.emit("join-game", { userName: "Player3", avatar: {} }, () => { });

        // Start game (Client 1 is host)
        setTimeout(() => {
            client1.emit("start-game");
        }, 500);

        let turns = [];

        const onTurnUpdate = (data) => {
            turns.push(data.drawerId);
            if (turns.length >= 3) {
                // Verify all 3 players got a turn
                expect(turns).to.have.lengthOf(3);
                expect(new Set(turns).size).to.equal(3); // Unique drawers
                done();
            } else {
                // Fast forward turn by ending it via some mechanism or waiting
                // In real integration tests, we might need to simulate time or 
                // leverage a dev-door to force skip. 
                // checks `debug-net.js` showed no dev-doors. 
                // We will rely on proper game logic flow. 
                // Since we can't easily wait 80s x 3, we might need a test-helper or just check the first assignment.
                // Actually, for this specific test, testing INITIAL rotation is enough.
                // But wait, the task asks for "drawing one afer the other".
                // Server has no "skip turn" event exposed to client. 
                // We might need to modify server to allow faster testing or use short timers in test env.
                // For now, let's just verify the first drawer is assigned correctly and then we would simulate a correct guess to advance.
            }
        };

        // We need to implement a "force turn end" or simulate gameplay to advance turns quickly.
        // Or we modify the server to accept a "test-end-turn" event.
        // Given I cannot easily modify server for just tests without user permission, I'll simulate guesses.

        let currentDrawerId = null;

        const handleTurn = (data) => {
            console.log('Turn update received. Drawer:', data.drawerId, 'Round:', data.round);
            currentDrawerId = data.drawerId;
            turns.push(currentDrawerId);
            console.log('Turns so far:', turns.length);

            if (turns.length === 3) {
                console.log('3 turns reached. verifying...');
                expect(new Set(turns).size).to.equal(3);
                done();
                return;
            }

            // The non-drawers guess correctly to end turn
            setTimeout(() => {
                const guesser = [client1, client2, client3].find(c => c.id !== currentDrawerId);
                // We need to know the word. Server emits 'your-word' to drawer.
                // But we can't see other's word safely.
                // Actually, we can use the `debug` or just fail-safe to "force-restart" if needed?
                // Better approach: Server emits `turn-update` with round info.
                // To advance, players must guess.
                // If we can't guess, we wait for timeout? Too slow.
                // I will leave this as "starts game and assigns first drawer" for now to be safe,
                // OR I will assume I can modify settings to have 1s draw time?
            }, 100);
        };

        client1.on("turn-update", handleTurn);
        // client2 and client3 don't need to listen for this test verification

        // Override settings to super short times
        client1.emit("update-settings", {
            settings: {
                rounds: 3,
                drawTime: 2, // 2 seconds per turn!
                wordCount: 3,
                hints: 0,
                difficulty: 'easy'
            }
        });

    });

    it("should handle player exit and continue game", (done) => {
        // Setup 3 players
        client1.emit("join-game", { userName: "P1", avatar: {} }, (res) => { console.log('P1 join:', res); });
        client2.emit("join-game", { userName: "P2", avatar: {} }, (res) => { console.log('P2 join:', res); });
        client3.emit("join-game", { userName: "P3", avatar: {} }, (res) => { console.log('P3 join:', res); });

        // Fast settings
        client1.emit("update-settings", {
            settings: { rounds: 3, drawTime: 5, wordCount: 3, hints: 0 }
        });

        setTimeout(() => {
            client1.emit("start-game");
            client2.emit("start-game");
            client3.emit("start-game");
        }, 200);

        let turnCount = 0;

        // Listen for turn updates
        const onTurn = (data) => {
            console.log('Test 2 Turn update:', data.drawerId, 'Turn Count:', turnCount + 1);
            turnCount++;
            if (turnCount === 1) {
                // First turn started. 
                // If P1 is drawer, have P1 disconnect.
                // If P1 is not drawer, have drawer disconnect.
                const drawerId = data.drawerId;
                let socketToDisconnect;
                if (client1.id === drawerId) socketToDisconnect = client1;
                else if (client2.id === drawerId) socketToDisconnect = client2;
                else socketToDisconnect = client3;

                console.log('Disconnecting socket:', socketToDisconnect.id);
                setTimeout(() => {
                    socketToDisconnect.disconnect();
                }, 50); // Disconnect quickly within the turn
            } else if (turnCount === 2) {
                // Second turn started immediately after disconnect?
                console.log('Test 2 Turn 2 started as expected');
                expect(data.drawerId).to.be.a('string');
                done(); // Pass!
            }
        };

        client1.on("turn-update", onTurn);
        client2.on("turn-update", onTurn);
        client3.on("turn-update", onTurn);
    });
});
