import { test, expect } from '@playwright/test';

test.describe('UI Visibility & Robustness', () => {

    test('should display tools and canvas with network delay', async ({ page }) => {
        // Simulate Network Delay (Light 3G)
        const client = await page.context().newCDPSession(page);
        await client.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 50, // 50ms latency (was 500)
            downloadThroughput: 1000 * 1024 / 8,
            uploadThroughput: 1000 * 1024 / 8,
        });

        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err));

        console.log('Navigating to /');
        await page.goto('/');

        console.log('Filling input');
        // Join game
        await page.fill('#input-name', 'Tester');
        await page.click('#btn-make-game');

        console.log('Checking lobby');
        // Should be in lobby
        await expect(page.locator('#screen-lobby')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#lobby-player-list')).toContainText('Tester');

        console.log('Starting game');
        // Start game
        await page.click('#btn-start-game');

        console.log('Checking game screen');
        // Should be in game
        await expect(page.locator('#screen-game')).toBeVisible({ timeout: 10000 });

        // Tools checks
        await expect(page.locator('.toolbar')).toBeVisible();
        await expect(page.locator('#drawing-canvas')).toBeVisible();

        // Check specific tools
        await expect(page.locator('#tool-pencil')).toBeVisible();
        await expect(page.locator('#tool-eraser')).toBeVisible();
        await expect(page.locator('#tool-fill')).toBeVisible();

        // Check interactive
        await page.click('#tool-eraser');
        await expect(page.locator('#tool-eraser')).toHaveClass(/active/);

        await page.click('#tool-pencil');
        await expect(page.locator('#tool-pencil')).toHaveClass(/active/);

        // Wait a bit to ensure stability
        await page.waitForTimeout(2000);

        // Ensure no disconnect overlay
        await expect(page.locator('#reconnect-overlay')).not.toBeVisible();
    });
});
