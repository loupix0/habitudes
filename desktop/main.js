// Habitudes — application de bureau (Windows)
const { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setAppUserModelId('com.habitudes.desktop');

if (!app.requestSingleInstanceLock()) { app.quit(); }

const dataFile = () => path.join(app.getPath('userData'), 'habitudes.json');
let win;

function readData() {
  try { return fs.readFileSync(dataFile(), 'utf8'); } catch (e) { return null; }
}
function writeData(json) {
  const file = dataFile(), tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, file);          // écriture atomique : jamais de fichier à moitié écrit
}

ipcMain.on('habitudes:load', e => { e.returnValue = readData(); });
ipcMain.handle('habitudes:save', (e, json) => { writeData(json); return true; });
ipcMain.handle('habitudes:export', async (e, name, text) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Exporter une sauvegarde',
    defaultPath: path.join(app.getPath('documents'), name),
    filters: [{ name: 'Sauvegarde Habitudes', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, text, 'utf8');
  return true;
});

function createWindow() {
  win = new BrowserWindow({
    width: 1000, height: 820, minWidth: 380, minHeight: 560,
    title: 'Habitudes',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#131312' : '#f7f7f4',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); });
app.on('window-all-closed', () => app.quit());
