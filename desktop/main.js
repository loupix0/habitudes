// Habitudes — application de bureau (Windows)
const { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, shell, net } = require('electron');
const crypto = require('crypto');
const { spawn } = require('child_process');
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

/* ---------- Mises à jour automatiques ---------- */
const UPDATE_URL = process.env.HABITUDES_UPDATE_URL
  || 'https://github.com/loupix0/habitudes/releases/download/derniere-version/latest.json';
const updatesEnabled = process.platform === 'win32' || !!process.env.HABITUDES_UPDATE_URL;
let pendingUpdate = null, installing = false;

function isNewer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}
async function checkUpdate() {
  if (!updatesEnabled) return { status: 'unsupported', version: app.getVersion() };
  try {
    const r = await net.fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const info = await r.json();
    if (info && info.version && info.url && info.sha256 && isNewer(info.version, app.getVersion())) {
      pendingUpdate = info;
      if (win && !win.isDestroyed()) win.webContents.send('habitudes:update', { version: info.version });
      return { status: 'available', version: info.version };
    }
    return { status: 'latest', version: app.getVersion() };
  } catch (e) {
    return { status: 'error', version: app.getVersion() };
  }
}
async function installUpdate() {
  if (!pendingUpdate || installing) return false;
  installing = true;
  const send = pct => { if (win && !win.isDestroyed()) win.webContents.send('habitudes:update-progress', pct); };
  try {
    const r = await net.fetch(pendingUpdate.url + '?t=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const total = Number(r.headers.get('content-length')) || pendingUpdate.size || 0;
    const reader = r.body.getReader(), chunks = [];
    let got = 0, last = -1;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value)); got += value.length;
      const pct = total ? Math.floor(got / total * 100) : 0;
      if (pct !== last) { last = pct; send(pct); }
    }
    const buf = Buffer.concat(chunks);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    if (sha !== String(pendingUpdate.sha256).toLowerCase()) throw new Error('Fichier corrompu');
    const file = path.join(app.getPath('temp'), `Habitudes-Setup-${pendingUpdate.version}.exe`);
    fs.writeFileSync(file, buf);
    if (process.platform === 'win32') {
      // installation silencieuse, puis l'installateur relance l'app
      spawn(file, ['/S', '/relaunch'], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => app.quit(), 300);
    } else {
      console.log('UPDATE_READY ' + file);   // mode test hors Windows
    }
    return true;
  } catch (e) {
    installing = false;
    throw e;
  }
}
ipcMain.handle('habitudes:version', () => app.getVersion());
ipcMain.handle('habitudes:update-check', () => checkUpdate());
ipcMain.handle('habitudes:update-install', async () => {
  try { return await installUpdate(); } catch (e) { return false; }
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
  win.webContents.once('did-finish-load', () => setTimeout(checkUpdate, 3000));
}
setInterval(checkUpdate, 6 * 60 * 60 * 1000);

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); });
app.on('window-all-closed', () => app.quit());
