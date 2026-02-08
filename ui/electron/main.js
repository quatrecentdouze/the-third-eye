const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let agentProcess = null;

const APP_VERSION = require('../package.json').version;

function getAgentPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'agent', 'the_third_eye.exe');
    }
    return path.join(__dirname, '..', '..', 'build', 'the_third_eye.exe');
}

function splashProgress(percent, text) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-progress', { percent, text, version: APP_VERSION });
    }
}

function createSplash() {
    splashWindow = new BrowserWindow({
        width: 340,
        height: 220,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        show: false,
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
        splashProgress(5, 'Initializing...');
    });
}

function startAgent() {
    const agentPath = getAgentPath();
    if (!fs.existsSync(agentPath)) {
        console.log('[electron] Agent not found at', agentPath, '— skipping');
        return;
    }

    console.log('[electron] Starting agent:', agentPath);
    agentProcess = spawn(agentPath, ['--port', '9100', '--interval', '2', '--log-level', 'info'], {
        stdio: 'ignore',
        detached: false,
        windowsHide: true,
    });

    agentProcess.on('error', (err) => {
        console.error('[electron] Agent failed to start:', err.message);
        agentProcess = null;
    });

    agentProcess.on('exit', (code) => {
        console.log('[electron] Agent exited with code', code);
        agentProcess = null;
    });
}

function stopAgent() {
    if (agentProcess) {
        console.log('[electron] Stopping agent...');
        try {
            spawn('taskkill', ['/F', '/PID', String(agentProcess.pid)], { stdio: 'ignore' });
        } catch {
            agentProcess.kill();
        }
        agentProcess = null;
    }
}

function waitForAgent(timeout = 8000) {
    return new Promise((resolve) => {
        const start = Date.now();
        let attempt = 0;
        const check = () => {
            attempt++;
            const elapsed = Date.now() - start;
            const pct = Math.min(15 + Math.floor((elapsed / timeout) * 55), 70);
            splashProgress(pct, 'Waiting for agent...');

            const req = http.get('http://127.0.0.1:9100/api/status', (res) => {
                res.resume();
                resolve(true);
            });
            req.on('error', () => {
                if (Date.now() - start > timeout) return resolve(false);
                setTimeout(check, 250);
            });
            req.setTimeout(500, () => { req.destroy(); });
        };
        check();
    });
}

function checkViteRunning() {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:5173', () => resolve(true));
        req.on('error', () => resolve(false));
        req.setTimeout(500, () => { req.destroy(); resolve(false); });
    });
}

function createWindow(useDevServer) {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'the-third-eye',
        backgroundColor: '#0a0a0f',
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
    });

    if (useDevServer) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
        mainWindow.loadFile(distIndex);
    }

    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
        }
        mainWindow.show();
    });

    mainWindow.on('close', (e) => {
        if (tray) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setToolTip('the-third-eye — System Monitor');

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Dashboard', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
        { type: 'separator' },
        { label: 'Quit', click: () => { tray.destroy(); tray = null; app.quit(); } },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
}

function setupAutoUpdate() {
    if (!app.isPackaged) return;

    let autoUpdater;
    try {
        autoUpdater = require('electron-updater').autoUpdater;
    } catch {
        console.log('[electron] electron-updater not available');
        return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => console.log('[updater] Checking for update...'));
    autoUpdater.on('update-available', (info) => console.log('[updater] Update available:', info.version));
    autoUpdater.on('update-not-available', () => console.log('[updater] Up to date'));
    autoUpdater.on('download-progress', (p) => console.log(`[updater] Downloading: ${p.percent.toFixed(0)}%`));
    autoUpdater.on('update-downloaded', (info) => {
        console.log('[updater] Update downloaded:', info.version);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-ready', info.version);
        }
    });
    autoUpdater.on('error', (err) => console.error('[updater] Error:', err.message));

    autoUpdater.checkForUpdates().catch(() => { });
}

ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.on('install-update', () => {
    try {
        const { autoUpdater } = require('electron-updater');
        autoUpdater.quitAndInstall();
    } catch { }
});

app.whenReady().then(async () => {
    createSplash();

    splashProgress(10, 'Starting agent...');
    startAgent();

    const agentReady = await waitForAgent();
    splashProgress(75, agentReady ? 'Agent ready' : 'Agent not detected');

    splashProgress(80, 'Loading dashboard...');
    const useDevServer = await checkViteRunning();
    if (useDevServer) {
        console.log('[electron] Using Vite dev server at http://localhost:5173');
    } else {
        console.log('[electron] Loading production build from dist/');
    }

    splashProgress(90, 'Almost ready...');
    createWindow(useDevServer);
    createTray();

    setupAutoUpdate();
});

app.on('before-quit', () => {
    stopAgent();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow(false);
});
