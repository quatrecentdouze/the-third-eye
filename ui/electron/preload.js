const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    platform: process.platform,
    onUpdateReady: (cb) => ipcRenderer.on('update-ready', (_, version) => cb(version)),
    installUpdate: () => ipcRenderer.send('install-update'),
    getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
    getNotificationsEnabled: () => ipcRenderer.invoke('get-notifications-enabled'),
    setNotificationsEnabled: (v) => ipcRenderer.send('set-notifications-enabled', v),
});
