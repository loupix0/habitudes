const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('habitudesDesktop', {
  load: async () => ipcRenderer.sendSync('habitudes:load'),
  save: json => ipcRenderer.invoke('habitudes:save', json),
  exportFile: (name, text) => ipcRenderer.invoke('habitudes:export', name, text),
});
