const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const Store = require('electron-store');

const store = new Store({ defaults: { notificationsEnabled: true } });
let seenAlertKeys = new Set();

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

function getIconPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'icon.png');
    }
    return path.join(__dirname, '..', '..', 'img', 'icon.png');
}

function splashProgress(percent, text) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-progress', { percent, text, version: APP_VERSION });
    }
}

function createSplash() {
    splashWindow = new BrowserWindow({
        width: 340,
        height: 240,
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
        icon: getIconPath(),
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

    mainWindow.webContents.on('did-finish-load', () => {
        notifyRendererOfUpdate();
    });

    mainWindow.on('close', (e) => {
        if (tray) {
            e.preventDefault();
            mainWindow.hide();
            tray.displayBalloon({
                iconType: 'info',
                title: 'The Third Eye',
                content: 'Still running in the background. Double-click the tray icon to reopen.',
            });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 });
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

let pendingUpdateVersion = null;

function setupAutoUpdate() {
    return new Promise((resolve) => {
        const logPath = path.join(app.getPath('userData'), 'updater.log');
        const log = (msg) => {
            const line = `[${new Date().toISOString()}] ${msg}\n`;
            fs.appendFileSync(logPath, line);
            console.log(msg);
        };

        log(`[updater] App packaged: ${app.isPackaged}, version: ${APP_VERSION}`);
        if (!app.isPackaged) {
            log('[updater] Not packaged, skipping auto-update');
            return resolve({ hasUpdate: false });
        }

        let autoUpdater;
        try {
            autoUpdater = require('electron-updater').autoUpdater;
            log('[updater] electron-updater loaded successfully');
        } catch (e) {
            log(`[updater] Failed to load electron-updater: ${e.message}`);
            return resolve({ hasUpdate: false });
        }

        let resolved = false;
        const done = (result) => {
            if (resolved) return;
            resolved = true;
            resolve(result);
        };

        setTimeout(() => {
            log('[updater] Timeout reached, proceeding without update');
            done({ hasUpdate: false });
        }, 30000);

        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('checking-for-update', () => {
            log('[updater] Checking for update...');
            splashProgress(48, 'Checking for updates...');
        });

        autoUpdater.on('update-available', (info) => {
            log(`[updater] Update available: ${info.version}`);
            splashProgress(50, `Downloading v${info.version}...`);
            splashDownload({ percent: 0, transferred: 0, total: 0, speed: 0, version: info.version });
        });

        autoUpdater.on('update-not-available', (info) => {
            log(`[updater] Up to date (latest: ${info.version})`);
            splashProgress(90, 'Up to date');
            splashDownload(null);
            done({ hasUpdate: false });
        });

        autoUpdater.on('download-progress', (p) => {
            log(`[updater] Downloading: ${p.percent.toFixed(1)}%`);
            const mappedPercent = 50 + (p.percent / 100) * 40;
            splashProgress(Math.round(mappedPercent), `Downloading update...`);
            splashDownload({
                percent: p.percent,
                transferred: p.transferred,
                total: p.total,
                speed: p.bytesPerSecond,
            });
        });

        autoUpdater.on('update-downloaded', (info) => {
            log(`[updater] Update downloaded: ${info.version}`);
            pendingUpdateVersion = info.version;
            splashProgress(92, `v${info.version} ready to install`);
            splashDownload(null);
            done({ hasUpdate: true, version: info.version });
        });

        autoUpdater.on('error', (err) => {
            log(`[updater] ERROR: ${err.message}\n${err.stack || ''}`);
            splashDownload(null);
            done({ hasUpdate: false });
        });

        autoUpdater.checkForUpdates()
            .then((result) => log(`[updater] checkForUpdates resolved: ${JSON.stringify(result?.updateInfo?.version || 'no info')}`))
            .catch((err) => {
                log(`[updater] checkForUpdates REJECTED: ${err.message}`);
                done({ hasUpdate: false });
            });
    });
}

function splashDownload(data) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('splash-download', data);
    }
}

function notifyRendererOfUpdate() {
    if (!pendingUpdateVersion || !mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('update-ready', pendingUpdateVersion);
}

ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle('get-update-status', () => pendingUpdateVersion);
ipcMain.on('install-update', () => {
    try {
        const { autoUpdater } = require('electron-updater');
        autoUpdater.quitAndInstall();
    } catch { }
});
ipcMain.handle('get-notifications-enabled', () => store.get('notificationsEnabled'));
ipcMain.on('set-notifications-enabled', (_, enabled) => store.set('notificationsEnabled', enabled));

const TYPE_LABELS = { cpu_high: 'High CPU', memory_high: 'High Memory', collect_slow: 'Slow Collection' };

function startAlertPoller() {
    setInterval(() => {
        if (!store.get('notificationsEnabled')) return;
        const req = http.get('http://localhost:9100/api/alerts', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const active = json.active || [];
                    for (const alert of active) {
                        const key = `${alert.type}:${alert.timestamp}`;
                        if (seenAlertKeys.has(key)) continue;
                        seenAlertKeys.add(key);
                        const iconPath = path.join(__dirname, 'icon.ico');
                        const n = new Notification({
                            title: `⚠ ${TYPE_LABELS[alert.type] || alert.type}`,
                            body: alert.message,
                            icon: fs.existsSync(iconPath) ? iconPath : undefined,
                        });
                        n.on('click', () => {
                            if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
                        });
                        n.show();
                    }
                    if (seenAlertKeys.size > 500) seenAlertKeys = new Set();
                } catch { }
            });
        });
        req.on('error', () => { });
        req.setTimeout(3000, () => req.destroy());
    }, 5000);
}

app.whenReady().then(async () => {
    createSplash();

    splashProgress(10, 'Starting agent...');
    startAgent();

    const agentReady = await waitForAgent();
    splashProgress(40, agentReady ? 'Agent ready' : 'Agent not detected');

    splashProgress(45, 'Checking for updates...');
    const updateResult = await setupAutoUpdate();

    splashProgress(92, 'Loading dashboard...');
    const useDevServer = await checkViteRunning();
    if (useDevServer) {
        console.log('[electron] Using Vite dev server at http://localhost:5173');
    } else {
        console.log('[electron] Loading production build from dist/');
    }

    splashProgress(96, 'Almost ready...');
    createWindow(useDevServer);
    createTray();
    startAlertPoller();
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
