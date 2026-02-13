import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3001',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'cd ../server && set PORT=3001 && set TEST_MODE=true && npm run server',
        port: 3001,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
    },
});
