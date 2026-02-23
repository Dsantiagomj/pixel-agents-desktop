import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;

const CONFIG_DIR = '.pixel-agents';
const SETTINGS_FILE = 'settings.json';

interface Settings {
  soundEnabled: boolean;
  alwaysOnTop: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number };
}

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  alwaysOnTop: false,
};

function getSettingsPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, SETTINGS_FILE);
}

function readSettings(): Settings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings: Settings): void {
  const dir = path.join(os.homedir(), CONFIG_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

function getAssetsRoot(): string {
  // In production: resources/app/dist/assets
  // In development: dist/assets (copied by esbuild.main.mjs)
  const prodPath = path.join(__dirname, '..', 'assets');
  if (fs.existsSync(prodPath)) return prodPath;

  // Fallback: check renderer/public/assets (dev without build)
  const devPath = path.join(__dirname, '..', '..', 'renderer', 'public', 'assets');
  if (fs.existsSync(devPath)) return devPath;

  return prodPath; // Will fail gracefully if missing
}

function getLayoutPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, 'layout.json');
}

function readLayout(): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(getLayoutPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLayout(layout: Record<string, unknown>): void {
  const dir = path.join(os.homedir(), CONFIG_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = getLayoutPath() + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(layout), 'utf-8');
  fs.renameSync(tmpPath, getLayoutPath());
}

function loadDefaultLayout(): Record<string, unknown> | null {
  try {
    const defaultPath = path.join(getAssetsRoot(), 'default-layout.json');
    const raw = fs.readFileSync(defaultPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function send(channel: string, data?: unknown): void {
  mainWindow?.webContents.send(channel, data ?? {});
}

function createWindow(): BrowserWindow {
  const settings = readSettings();

  const win = new BrowserWindow({
    width: settings.windowBounds?.width ?? 900,
    height: settings.windowBounds?.height ?? 700,
    x: settings.windowBounds?.x,
    y: settings.windowBounds?.y,
    alwaysOnTop: settings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Pixel Agents',
    backgroundColor: '#1e1e2e',
  });

  // Load renderer
  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_DEV'] === '1') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
    win.loadFile(indexPath);
  }

  // Save window bounds on move/resize
  const saveBounds = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      const settings = readSettings();
      settings.windowBounds = win.getBounds();
      writeSettings(settings);
    }
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  return win;
}

function setupIPC(): void {
  ipcMain.on('webviewReady', async () => {
    const settings = readSettings();
    send('settingsLoaded', { soundEnabled: settings.soundEnabled });

    // Send layout
    const saved = readLayout();
    const defaultLayout = loadDefaultLayout();
    send('layoutLoaded', { layout: saved ?? defaultLayout });
  });

  ipcMain.on('saveLayout', (_event, data: { layout: Record<string, unknown> }) => {
    writeLayout(data.layout);
  });

  ipcMain.on('setSoundEnabled', (_event, data: { enabled: boolean }) => {
    const settings = readSettings();
    settings.soundEnabled = data.enabled;
    writeSettings(settings);
  });

  ipcMain.on('saveAgentSeats', () => {
    // Stub — seat persistence can be added later
  });

  ipcMain.on('exportLayout', async () => {
    const layout = readLayout();
    if (!layout || !mainWindow) return;
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      defaultPath: path.join(os.homedir(), 'pixel-agents-layout.json'),
    });
    if (result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(layout, null, 2), 'utf-8');
    }
  });

  ipcMain.on('importLayout', async () => {
    if (!mainWindow) return;
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (!result.filePaths.length) return;
    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
      const imported = JSON.parse(raw) as Record<string, unknown>;
      if (imported.version !== 1 || !Array.isArray(imported.tiles)) {
        dialog.showErrorBox('Pixel Agents', 'Invalid layout file.');
        return;
      }
      writeLayout(imported);
      send('layoutLoaded', { layout: imported });
    } catch {
      dialog.showErrorBox('Pixel Agents', 'Failed to read or parse layout file.');
    }
  });

  ipcMain.on('openSessionsFolder', () => {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');
    if (fs.existsSync(claudeDir)) {
      shell.openPath(claudeDir);
    }
  });

  // Stub handlers for messages we don't handle yet
  ipcMain.on('focusAgent', () => { /* No terminal to focus in standalone mode */ });
  ipcMain.on('closeAgent', () => { /* Agent lifecycle managed by discovery */ });
  ipcMain.on('openClaude', () => { /* No terminal spawning in standalone mode */ });
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
