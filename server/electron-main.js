const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const { server, stopServer, startServer } = require('./index.js'); // Import the server to start it and stop it

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow;
let tray;
let isQuitting = false;

// Ignore certificate errors for self-signed certificates (development only)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // Only for localhost
    if (url.startsWith('https://localhost')) {
        event.preventDefault();
        callback(true); // Trust the certificate
    } else {
        callback(false);
    }
});

async function createWindow() {
    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the local server URL
    // Load the local server URL
    // Use HTTPS if TLS is enabled, otherwise HTTP
    const protocol = process.env.USE_TLS === 'true' ? 'https' : 'http';

    // Start server and get the actual port
    try {
        const port = await startServer(3001);
        const serverUrl = `${protocol}://localhost:${port}`;

        console.log(`Loading window from: ${serverUrl}`);
        mainWindow.loadURL(serverUrl);
    } catch (err) {
        console.error('Failed to start server:', err);
        // Fallback or error display could go here
    }


    // Allow window to close naturally, which will trigger window-all-closed
    // mainWindow.on('close', (event) => { ... });
}

function createTray() {
    try {
        let iconPath;
        if (process.platform === 'linux') {
            iconPath = path.join(__dirname, 'assets', 'tray.png');
        } else {
            iconPath = path.join(__dirname, 'assets', 'icon.ico');
        }

        const icon = require('electron').nativeImage.createFromPath(iconPath);

        if (icon.isEmpty()) {
            console.warn("Tray icon is empty or invalid format");
        }

        tray = new Tray(icon);
        tray.setToolTip('ClassSend Server');

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Open',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                    } else {
                        createWindow();
                    }
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Start on Login',
                type: 'checkbox',
                checked: app.getLoginItemSettings().openAtLogin,
                click: (menuItem) => {
                    app.setLoginItemSettings({
                        openAtLogin: menuItem.checked
                    });
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Enable TLS/HTTPS',
                type: 'checkbox',
                checked: process.env.USE_TLS === 'true',
                click: async (menuItem) => {
                    const { dialog } = require('electron');
                    const result = await dialog.showMessageBox({
                        type: 'question',
                        buttons: ['Yes', 'No'],
                        title: 'Restart Required',
                        message: 'Changing TLS settings requires restarting the application. Continue?'
                    });

                    if (result.response === 0) {
                        // Set environment variable
                        process.env.USE_TLS = menuItem.checked ? 'true' : 'false';

                        // Restart app
                        app.relaunch();
                        app.exit(0);
                    } else {
                        // Revert checkbox
                        menuItem.checked = !menuItem.checked;
                    }
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Close',
                click: async () => {
                    isQuitting = true;
                    try {
                        await stopServer();
                    } catch (error) {
                        console.error('Error stopping server:', error);
                    }
                    app.exit(0); // Force exit to ensure process terminates
                }
            }
        ]);

        tray.setContextMenu(contextMenu);

        // Double-click to show window
        tray.on('double-click', () => {
            if (mainWindow) {
                mainWindow.show();
            } else {
                createWindow();
            }
        });

    } catch (error) {
        console.error("Failed to create tray:", error);
    }
}

app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', async () => {
    // Stop server before quitting
    try {
        await stopServer();
    } catch (error) {
        console.error('Error stopping server:', error);
    }
    app.quit();
});
