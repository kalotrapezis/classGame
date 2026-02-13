const { io } = require("socket.io-client");
const { expect } = require("chai");
const { startServer, stopServer } = require("../index");

const PORT = 3003;
const SERVER_URL = `http://localhost:${PORT}`;

describe("Robustness Tests", function () {
    this.timeout(20000);
    let clients = [];

    before(async () => {
        await startServer(PORT);
    });

    after(async () => {
        await stopServer();
    });

    afterEach(() => {
        clients.forEach(c => c.disconnect());
        clients = [];
    });

    it("should handle vote spam without crashing", (done) => {
        // Create 5 clients
        const clientCount = 5;
        let connected = 0;

        for (let i = 0; i < clientCount; i++) {
            const socket = io(SERVER_URL);
            clients.push(socket);
            socket.on('connect', () => {
                connected++;
                if (connected === clientCount) startSpamTest();
            });
            socket.emit("join-game", { userName: `Spammer${i}`, avatar: {} }, () => { });
        }

        function startSpamTest() {
            const host = clients[0];
            const target = clients[1]; // Vote target

            // Start game
            host.emit("start-game");

            // Wait for game start
            setTimeout(() => {
                // Everyone spams vote start against target
                clients.forEach(c => {
                    setInterval(() => {
                        c.emit("start-vote", { targetId: target.id });
                    }, 50); // Aggressive spam
                });

                // Run for 2 seconds then check if server is alive
                setTimeout(() => {
                    // Verify server still responds
                    host.emit("ping-check", {}, () => {
                        done();
                    });
                }, 2000);
            }, 1000);
        }
    });

    it("should handle rapid join/leave (churn)", function (done) {
        this.timeout(15000);
        const totalCycles = 50;
        let completedCycles = 0;

        // One stable client to monitor
        const monitor = io(SERVER_URL);
        clients.push(monitor);

        monitor.on('connect', () => {
            monitor.emit("join-game", { userName: "Monitor", avatar: {} }, () => { });
            startChurn();
        });

        function startChurn() {
            let active = 0;
            const interval = setInterval(() => {
                if (completedCycles >= totalCycles) {
                    clearInterval(interval);
                    // Check if monitor is still happy
                    monitor.emit("ping-check", {}, () => {
                        done();
                    });
                    return;
                }

                // Join a new client
                const tempClient = io(SERVER_URL);
                tempClient.on('connect', () => {
                    tempClient.emit("join-game", { userName: `Churn${completedCycles}`, avatar: {} }, () => {
                        // Immediately disconnect
                        tempClient.disconnect();
                        completedCycles++;
                    });
                });

            }, 50);
        }
    });
});
