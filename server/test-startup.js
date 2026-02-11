const { startServer, stopServer } = require('./index');

async function test() {
    console.log('--- Testing Server Startup ---');
    try {
        const port = await startServer(3001);
        console.log(`Server started on port: ${port}`);

        if (port === 3001) {
            console.log('FAIL: Should have fallen back to 3002 (3001 is busy)');
        } else if (port === 3002) {
            console.log('SUCCESS: Fell back to 3002');
        } else {
            console.log(`WARNING: Unexpected port ${port}`);
        }

        await stopServer();
        console.log('Server stopped');
    } catch (err) {
        console.error('TEST FAILED:', err);
    }
}

test();
