const { startServer, stopServer } = require('./index');
const net = require('net');

function checkPort(port) {
    return new Promise((resolve) => {
        const tester = net.createServer()
            .once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true); // Port is busy
                } else {
                    resolve(false);
                }
            })
            .once('listening', () => {
                tester.close();
                resolve(false); // Port is free
            })
            .listen(port);
    });
}

async function test() {
    console.log('--- Debugging Server Startup ---');

    const is3001Busy = await checkPort(3001);
    console.log(`Is port 3001 busy before start? ${is3001Busy}`);

    try {
        const port = await startServer(3001);
        console.log(`Server started on port: ${port}`);

        if (is3001Busy && port === 3001) {
            console.log('CRITICAL FAIL: Port 3001 was busy but we bound to it anyway?');
        } else if (is3001Busy && port !== 3001) {
            console.log('SUCCESS: Correctly fell back to another port');
        } else if (!is3001Busy && port === 3001) {
            console.log('OK: Port was free and we took it (but test setup failed to reserve it)');
        }

        await stopServer();
        console.log('Server stopped');
    } catch (err) {
        console.error('TEST FAILED:', err);
    }
}

test();
