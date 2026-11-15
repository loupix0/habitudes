const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('habitudesDesktop', {
  load: async () => ipcRenderer.sendSync('habitudes:load'),
  save: json => ipcRenderer.invoke('habitudes:save', json),
  exportFile: (name, text) => ipcRenderer.invoke('habitudes:export', name, text),
  version: () => ipcRenderer.invoke('habitudes:version'),
  checkUpdate: () => ipcRenderer.invoke('habitudes:update-check'),
  installUpdate: () => ipcRenderer.invoke('habitudes:update-install'),
  onUpdate: cb => ipcRenderer.on('habitudes:update', (e, info) => cb(info)),
  onUpdateProgress: cb => ipcRenderer.on('habitudes:update-progress', (e, pct) => cb(pct)),
});
