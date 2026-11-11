// Construit l'app Windows : dossier portable (.zip) + installateur (.exe)
// Usage : npm install && npm run build:win   (Linux ou Windows ; l'installateur demande makensis)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ResEdit = require('resedit');

const pkg = require('./package.json');
const ELECTRON = pkg.devDependencies.electron;
const VERSION = pkg.version;
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(__dirname, '.cache');
const OUT = path.join(DIST, 'win-unpacked');
const zipName = `electron-v${ELECTRON}-win32-x64.zip`;
const zipPath = path.join(CACHE, zipName);
const run = (cmd, args, opts) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

fs.mkdirSync(CACHE, { recursive: true });
if (!fs.existsSync(zipPath)) {
  console.log('Téléchargement de Electron', ELECTRON, 'pour Windows…');
  run('curl', ['-fL', '--retry', '3', '-o', zipPath, `https://github.com/electron/electron/releases/download/v${ELECTRON}/${zipName}`]);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
run('unzip', ['-q', zipPath, '-d', OUT]);
fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, 'Habitudes.exe'));
fs.rmSync(path.join(OUT, 'resources', 'default_app.asar'), { force: true });

// Code de l'app
const appDir = path.join(OUT, 'resources', 'app');
fs.mkdirSync(path.join(appDir, 'www'), { recursive: true });
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: 'habitudes', productName: 'Habitudes', version: VERSION, main: 'main.js' }, null, 2));
for (const f of ['main.js', 'preload.js', 'icon.png']) fs.copyFileSync(path.join(__dirname, f), path.join(appDir, f));
for (const f of fs.readdirSync(path.join(ROOT, 'www'))) fs.copyFileSync(path.join(ROOT, 'www', f), path.join(appDir, 'www', f));

// Icône + informations de version dans Habitudes.exe
const exePath = path.join(OUT, 'Habitudes.exe');
const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const groupId = groups.length ? groups[0].id : 1;
const lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, ico.icons.map(i => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const [a, b, c] = VERSION.split('.').map(Number);
vi.setFileVersion(a, b, c, 0, 1033);
vi.setProductVersion(a, b, c, 0, 1033);
vi.setStringValues({ lang: 1033, codepage: 1200 }, {
  ProductName: 'Habitudes', FileDescription: 'Habitudes', CompanyName: 'Habitudes',
  OriginalFilename: 'Habitudes.exe', InternalName: 'Habitudes', LegalCopyright: '',
  FileVersion: VERSION, ProductVersion: VERSION,
});
vi.outputToResourceEntries(res.entries);
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));

// Version portable (.zip)
const portable = path.join(DIST, 'Habitudes-Windows-portable.zip');
fs.rmSync(portable, { force: true });
fs.rmSync(path.join(DIST, 'Habitudes'), { recursive: true, force: true });
fs.renameSync(OUT, path.join(DIST, 'Habitudes'));
run('zip', ['-qr9', portable, 'Habitudes'], { cwd: DIST });
fs.renameSync(path.join(DIST, 'Habitudes'), OUT);
console.log('✓', path.relative(ROOT, portable));

// Installateur (.exe)
const setup = path.join(DIST, 'Habitudes-Setup.exe');
try {
  run('makensis', ['-V2', `-DVERSION=${VERSION}`, `-DSRCDIR=${OUT}`, `-DOUTFILE=${setup}`, 'installer.nsi'], { cwd: __dirname });
  console.log('✓', path.relative(ROOT, setup));
} catch (e) {
  console.log('makensis introuvable : installateur non généré (la version portable suffit).');
}
