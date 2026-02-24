import { app, BrowserWindow, ipcMain, dialog, shell, Tray } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadCharacterSprites, loadFloorTiles, loadWallTiles, loadFurnitureAssets } from './assetLoader.js';
import { AgentDiscovery } from './agentDiscovery.js';
import { startFileWatching, stopFileWatching, readNewLines } from './fileWatcher.js';
import { createTray } from './tray.js';
import type { AgentState, IpcBridge } from './types.js';

let mainWindow: BrowserWindow | null = null;
let discovery: AgentDiscovery | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const CONFIG_DIR = '.pixel-agents';
const SETTINGS_FILE = 'settings.json';

// Agent management state
const fileWatchers = new Map<number, fs.FSWatcher>();
const pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
const waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();

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
  const prodPath = path.join(__dirname, '..', 'assets');
  if (fs.existsSync(prodPath)) return prodPath;

  const devPath = path.join(__dirname, '..', '..', 'renderer', 'public', 'assets');
  if (fs.existsSync(devPath)) return devPath;

  return prodPath;
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

// IPC bridge for file watcher and transcript parser
const bridge: IpcBridge = {
  send(channel: string, data: unknown): void {
    send(channel, data);
  },
};

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

  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_DEV'] === '1') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
    win.loadFile(indexPath);
  }

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

function startDiscovery(): void {
  discovery = new AgentDiscovery({
    onAgentDiscovered: (agent: AgentState) => {
      console.log(`[Pixel Agents] Sending agentCreated for agent ${agent.id}`);
      send('agentCreated', { id: agent.id });

      // Start watching this agent's JSONL file
      const agents = discovery!.getAgents();
      startFileWatching(
        agent.id, agent.jsonlFile,
        agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
        bridge,
      );

      // Do an initial read to catch up on any recent activity
      readNewLines(agent.id, agents, waitingTimers, permissionTimers, bridge);
    },
    onAgentDormant: (agentId: number) => {
      console.log(`[Pixel Agents] Agent ${agentId} went dormant`);
      stopFileWatching(agentId, fileWatchers, pollingTimers, waitingTimers, permissionTimers);
      send('agentClosed', { id: agentId });
    },
  });
  discovery.start();
}

function stopDiscovery(): void {
  if (discovery) {
    // Stop all file watchers
    for (const agentId of discovery.getAgentIds()) {
      stopFileWatching(agentId, fileWatchers, pollingTimers, waitingTimers, permissionTimers);
    }
    discovery.stop();
    discovery = null;
  }
}

function setupIPC(): void {
  ipcMain.on('webviewReady', async () => {
    const assetsDir = getAssetsRoot();

    // Load and send assets in correct order (sprites before layout)
    const charSprites = loadCharacterSprites(assetsDir);
    if (charSprites) {
      send('characterSpritesLoaded', { characters: charSprites.characters });
    }

    const floorTiles = loadFloorTiles(assetsDir);
    if (floorTiles) {
      send('floorTilesLoaded', { sprites: floorTiles.sprites });
    }

    const wallTiles = loadWallTiles(assetsDir);
    if (wallTiles) {
      send('wallTilesLoaded', { sprites: wallTiles.sprites });
    }

    const furniture = loadFurnitureAssets(assetsDir);
    if (furniture) {
      send('furnitureAssetsLoaded', { catalog: furniture.catalog, sprites: furniture.sprites });
    }

    // Settings and layout sent last (before discovery)
    const settings = readSettings();
    send('settingsLoaded', { soundEnabled: settings.soundEnabled });

    const saved = readLayout();
    const defaultLayout = loadDefaultLayout();
    send('layoutLoaded', { layout: saved ?? defaultLayout });

    // Start agent discovery after layout is loaded
    startDiscovery();
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

  // Stub handlers — no terminal management in standalone mode
  ipcMain.on('focusAgent', () => {});
  ipcMain.on('closeAgent', () => {});
  ipcMain.on('openClaude', () => {});
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  tray = createTray(mainWindow);
  setupIPC();

  // macOS: hide to tray instead of quitting when closing window
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopDiscovery();
});
