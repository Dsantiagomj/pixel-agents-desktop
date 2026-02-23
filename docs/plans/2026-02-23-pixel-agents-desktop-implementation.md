# Pixel Agents Desktop — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone Electron desktop app that visualizes Claude Code AI agents as pixel art characters, forked from the pixel-agents VS Code extension.

**Architecture:** Electron main process watches `~/.claude/projects/**/*.jsonl` for active Claude Code sessions, parses JSONL transcripts, and sends events via IPC to a React+Canvas2D renderer (reused from pixel-agents webview-ui). No terminal spawning — pure auto-discovery via filesystem.

**Tech Stack:** Electron 35+, React 19, Vite 7, TypeScript 5.9, Canvas 2D, pngjs, electron-builder

**Source reference:** `/Users/danielmunoz/Develop/personal/pixel-agents/` (original VS Code extension to fork from)

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.main.json`
- Create: `.gitignore` (already exists, update if needed)

**Step 1: Initialize package.json**

```json
{
  "name": "pixel-agents-desktop",
  "version": "0.1.0",
  "description": "Standalone desktop app to visualize Claude Code agents as pixel art characters",
  "main": "dist/main/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:main\" \"npm run dev:renderer\"",
    "dev:main": "node esbuild.main.mjs --watch",
    "dev:renderer": "cd renderer && vite",
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "node esbuild.main.mjs",
    "build:renderer": "cd renderer && vite build",
    "start": "electron .",
    "dist": "npm run build && electron-builder"
  },
  "dependencies": {
    "pngjs": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pngjs": "^6.0.5",
    "concurrently": "^9.0.0",
    "electron": "^35.0.0",
    "electron-builder": "^26.0.0",
    "esbuild": "^0.27.0",
    "typescript": "^5.9.0"
  }
}
```

**Step 2: Create tsconfig.json (root)**

```json
{
  "references": [
    { "path": "./tsconfig.main.json" },
    { "path": "./renderer" }
  ],
  "files": []
}
```

**Step 3: Create tsconfig.main.json (Electron main process)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist/main",
    "rootDir": "src",
    "declaration": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src/**/*.ts"]
}
```

**Step 4: Create esbuild.main.mjs**

```javascript
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join } from 'path';

const isWatch = process.argv.includes('--watch');

// Copy assets from renderer/public/assets to dist/assets
const assetsSource = join('renderer', 'public', 'assets');
const assetsDest = join('dist', 'assets');
if (existsSync(assetsSource)) {
  mkdirSync(assetsDest, { recursive: true });
  cpSync(assetsSource, assetsDest, { recursive: true });
}

const config = {
  entryPoints: ['src/main.ts', 'src/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outdir: 'dist/main',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching main process...');
} else {
  await esbuild.build(config);
}
```

**Step 5: Run `npm install`**

Run: `npm install`
Expected: node_modules created, no errors

**Step 6: Commit**

```bash
git add package.json tsconfig.json tsconfig.main.json esbuild.main.mjs
git commit -m "chore: scaffold Electron project structure"
```

---

## Task 2: Copy Renderer (webview-ui) from pixel-agents

**Files:**
- Copy: `pixel-agents/webview-ui/` → `pixel-agents-desktop/renderer/`
- Modify: `renderer/package.json` (remove VS Code deps)
- Modify: `renderer/vite.config.ts` (adapt output path)

**Step 1: Copy the entire webview-ui directory**

```bash
cp -R /Users/danielmunoz/Develop/personal/pixel-agents/webview-ui/ /Users/danielmunoz/Develop/personal/pixel-agents-desktop/renderer/
```

**Step 2: Update renderer/package.json name**

Change `"name": "webview-ui"` → `"name": "pixel-agents-renderer"`

**Step 3: Update renderer/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
  },
  base: './',
})
```

**Step 4: Install renderer dependencies**

Run: `cd renderer && npm install && cd ..`
Expected: renderer/node_modules created

**Step 5: Verify renderer builds**

Run: `cd renderer && npm run build && cd ..`
Expected: `dist/renderer/` created with index.html and assets

**Step 6: Commit**

```bash
git add renderer/
git commit -m "feat: copy webview-ui from pixel-agents as renderer"
```

---

## Task 3: Create Electron Preload Bridge

**Files:**
- Create: `src/preload.ts`

**Step 1: Write preload.ts**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

type MessageCallback = (...args: unknown[]) => void;

const api = {
  send(channel: string, data?: unknown): void {
    ipcRenderer.send(channel, data);
  },
  on(channel: string, callback: MessageCallback): () => void {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  once(channel: string, callback: MessageCallback): void {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
```

**Step 2: Build to verify no errors**

Run: `node esbuild.main.mjs`
Expected: `dist/main/preload.js` created (will fail since main.ts doesn't exist yet — that's fine, create a placeholder)

**Step 3: Create placeholder main.ts for build**

```typescript
// Placeholder — will be implemented in Task 5
console.log('pixel-agents-desktop starting...');
```

**Step 4: Build again**

Run: `node esbuild.main.mjs`
Expected: `dist/main/main.js` and `dist/main/preload.js` created

**Step 5: Commit**

```bash
git add src/preload.ts src/main.ts
git commit -m "feat: add Electron preload bridge and placeholder main"
```

---

## Task 4: Replace vscodeApi with electronApi in Renderer

**Files:**
- Create: `renderer/src/electronApi.ts`
- Delete: `renderer/src/vscodeApi.ts`
- Modify: All files that import from `vscodeApi`

**Step 1: Create electronApi.ts**

```typescript
import type { ElectronAPI } from '../../src/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export const api = window.electronAPI;
```

**Step 2: Find all imports of vscodeApi**

Run: `rg "vscodeApi" renderer/src/ --files-with-matches`
Expected: List of files importing vscodeApi

**Step 3: Replace imports in each file**

Replace `import { vscode } from '../vscodeApi'` (or similar paths) with `import { api } from '../electronApi'` (adjusting relative path).

Replace all usages:
- `vscode.postMessage({ type: 'X', ... })` → `api.send('X', { ... })`

**Step 4: Delete vscodeApi.ts**

```bash
rm renderer/src/vscodeApi.ts
```

**Step 5: Verify renderer still compiles**

Run: `cd renderer && npx tsc --noEmit && cd ..`
Expected: Type errors related to message handling (expected — will fix in Task 9)

**Step 6: Commit**

```bash
git add renderer/src/electronApi.ts
git rm renderer/src/vscodeApi.ts
git add -u renderer/src/
git commit -m "refactor: replace vscodeApi with electronApi bridge"
```

---

## Task 5: Port Backend Types and Constants

**Files:**
- Create: `src/types.ts`
- Create: `src/constants.ts`

**Step 1: Create src/types.ts (remove vscode dependency)**

```typescript
export interface AgentState {
  id: number;
  projectDir: string;
  jsonlFile: string;
  fileOffset: number;
  lineBuffer: string;
  activeToolIds: Set<string>;
  activeToolStatuses: Map<string, string>;
  activeToolNames: Map<string, string>;
  activeSubagentToolIds: Map<string, Set<string>>;
  activeSubagentToolNames: Map<string, Map<string, string>>;
  isWaiting: boolean;
  permissionSent: boolean;
  hadToolsInTurn: boolean;
}

export interface PersistedAgent {
  id: number;
  jsonlFile: string;
  projectDir: string;
}
```

Note: Removed `terminalRef: vscode.Terminal` (no terminal management) and `terminalName` from PersistedAgent.

**Step 2: Create src/constants.ts (remove VS Code identifiers)**

```typescript
// ── Timing (ms) ──────────────────────────────────────────────
export const JSONL_POLL_INTERVAL_MS = 1000;
export const FILE_WATCHER_POLL_INTERVAL_MS = 2000;
export const PROJECT_SCAN_INTERVAL_MS = 1000;
export const TOOL_DONE_DELAY_MS = 300;
export const PERMISSION_TIMER_DELAY_MS = 7000;
export const TEXT_IDLE_DELAY_MS = 5000;

// ── Display Truncation ──────────────────────────────────────
export const BASH_COMMAND_DISPLAY_MAX_LENGTH = 30;
export const TASK_DESCRIPTION_DISPLAY_MAX_LENGTH = 40;

// ── PNG / Asset Parsing ─────────────────────────────────────
export const PNG_ALPHA_THRESHOLD = 128;
export const WALL_PIECE_WIDTH = 16;
export const WALL_PIECE_HEIGHT = 32;
export const WALL_GRID_COLS = 4;
export const WALL_BITMASK_COUNT = 16;
export const FLOOR_PATTERN_COUNT = 7;
export const FLOOR_TILE_SIZE = 16;
export const CHARACTER_DIRECTIONS = ['down', 'up', 'right'] as const;
export const CHAR_FRAME_W = 16;
export const CHAR_FRAME_H = 32;
export const CHAR_FRAMES_PER_ROW = 7;
export const CHAR_COUNT = 6;

// ── User-Level Persistence ─────────────────────────────────
export const CONFIG_DIR = '.pixel-agents';
export const LAYOUT_FILE_NAME = 'layout.json';
export const SETTINGS_FILE_NAME = 'settings.json';
export const AGENTS_FILE_NAME = 'agents.json';
export const LAYOUT_FILE_POLL_INTERVAL_MS = 2000;

// ── Agent Discovery ────────────────────────────────────────
export const AGENT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min no JSONL writes → dormant
export const DISCOVERY_SCAN_INTERVAL_MS = 2000;
export const CLAUDE_PROJECTS_DIR = '.claude/projects';
```

**Step 3: Commit**

```bash
git add src/types.ts src/constants.ts
git commit -m "feat: add backend types and constants (VS Code-free)"
```

---

## Task 6: Copy Platform-Independent Backend Modules

**Files:**
- Copy: `src/transcriptParser.ts` (unchanged)
- Copy: `src/timerManager.ts` (unchanged)

**Step 1: Copy transcriptParser.ts**

```bash
cp /Users/danielmunoz/Develop/personal/pixel-agents/src/transcriptParser.ts /Users/danielmunoz/Develop/personal/pixel-agents-desktop/src/
```

**Step 2: Verify imports — transcriptParser only imports from `path` and local constants**

Check that it imports from `./constants.js` — update `.js` extensions if needed for the build system (esbuild handles this).

**Step 3: Copy timerManager.ts**

```bash
cp /Users/danielmunoz/Develop/personal/pixel-agents/src/timerManager.ts /Users/danielmunoz/Develop/personal/pixel-agents-desktop/src/
```

**Step 4: Verify both compile**

Run: `node esbuild.main.mjs`
Expected: Builds successfully (or shows only errors from missing modules, not from these files)

**Step 5: Commit**

```bash
git add src/transcriptParser.ts src/timerManager.ts
git commit -m "feat: copy platform-independent transcript parser and timer manager"
```

---

## Task 7: Port layoutPersistence.ts

**Files:**
- Create: `src/layoutPersistence.ts` (adapted from pixel-agents)

**Step 1: Copy and adapt**

Copy from pixel-agents. The file uses `fs`, `path`, `os` — all available in Electron main process. Remove any `vscode` imports (there should be none in this file). Update the import of `LAYOUT_FILE_DIR` → `CONFIG_DIR` from our new constants.

Key changes:
- `LAYOUT_FILE_DIR` → `CONFIG_DIR`
- Verify all functions: `readLayoutFromFile()`, `writeLayoutToFile()`, `migrateAndLoadLayout()`, `watchLayoutFile()` — should work as-is

**Step 2: Remove workspace state migration code**

The `migrateAndLoadLayout()` function has a fallback that reads from `context.workspaceState`. Remove that VS Code–specific path, keep only: file → bundled default → `createDefaultLayout()`.

**Step 3: Verify it compiles**

Run: `node esbuild.main.mjs`

**Step 4: Commit**

```bash
git add src/layoutPersistence.ts
git commit -m "feat: port layout persistence (remove VS Code workspace state)"
```

---

## Task 8: Port assetLoader.ts

**Files:**
- Create: `src/assetLoader.ts` (adapted from pixel-agents)

**Step 1: Copy from pixel-agents**

Copy `src/assetLoader.ts`. This file uses `fs`, `path`, `pngjs` — all available in Electron.

**Step 2: Adapt asset path resolution**

In pixel-agents, assets are resolved relative to `extensionUri.fsPath`. In Electron, use `app.getAppPath()`:

Replace any reference to `extensionUri` or `extensionPath` parameters with a simple `assetsRoot: string` parameter.

The functions `loadFurnitureAssets(root)`, `loadFloorTiles(root)`, `loadWallTiles(root)`, `loadCharacterSprites(root)`, `loadDefaultLayout(root)` already take a root path — these should work as-is.

**Step 3: Adapt send functions**

Remove `sendAssetsToWebview(webview, assets)` etc. that call `webview.postMessage()`. Instead, export only the loader functions. The main process will handle sending via IPC.

**Step 4: Verify it compiles**

Run: `node esbuild.main.mjs`

**Step 5: Commit**

```bash
git add src/assetLoader.ts
git commit -m "feat: port asset loader (remove VS Code webview send)"
```

---

## Task 9: Port fileWatcher.ts

**Files:**
- Create: `src/fileWatcher.ts` (adapted from pixel-agents)

**Step 1: Copy from pixel-agents**

This file uses `fs`, `path`, and references `vscode.window.activeTerminal` for terminal adoption.

**Step 2: Remove VS Code terminal adoption**

Remove references to `vscode.window.activeTerminal`. In the desktop app, agents are auto-discovered — no terminal adoption needed.

The `ensureProjectScan()` function scans a project directory for unknown JSONL files. Keep this logic but adapt it:
- Remove the `activeAgentId` parameter (no active terminal concept)
- Instead of "adopting" terminals, just register new agents for any unknown JSONL file with recent activity

**Step 3: Remove the webview parameter**

Instead of calling `webview?.postMessage()`, have the file watcher emit events or call callbacks. The main process will bridge to IPC.

Pattern: Use callback functions passed in, e.g.:
```typescript
type EventCallback = (type: string, data: unknown) => void;
```

**Step 4: Verify it compiles**

Run: `node esbuild.main.mjs`

**Step 5: Commit**

```bash
git add src/fileWatcher.ts
git commit -m "feat: port file watcher (remove VS Code terminal adoption)"
```

---

## Task 10: Create Agent Discovery System

**Files:**
- Create: `src/agentDiscovery.ts`

**Step 1: Write the agent discovery module**

This is the key new module. It replaces `agentManager.ts` (which was terminal-based).

```typescript
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CLAUDE_PROJECTS_DIR,
  DISCOVERY_SCAN_INTERVAL_MS,
  AGENT_IDLE_TIMEOUT_MS,
} from './constants.js';
import type { AgentState } from './types.js';

export interface DiscoveryCallbacks {
  onAgentDiscovered: (agent: AgentState) => void;
  onAgentDormant: (agentId: number) => void;
}

export class AgentDiscovery {
  private agents = new Map<number, AgentState>();
  private knownFiles = new Map<string, number>(); // jsonlPath → agentId
  private nextId = 1;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private callbacks: DiscoveryCallbacks;

  constructor(callbacks: DiscoveryCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    this.scan();
    this.scanTimer = setInterval(() => this.scan(), DISCOVERY_SCAN_INTERVAL_MS);
  }

  stop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  getAgents(): Map<number, AgentState> {
    return this.agents;
  }

  private scan(): void {
    const claudeDir = path.join(os.homedir(), CLAUDE_PROJECTS_DIR);
    if (!fs.existsSync(claudeDir)) return;

    // Scan all project subdirectories
    try {
      const projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true });
      for (const dir of projectDirs) {
        if (!dir.isDirectory()) continue;
        const projectPath = path.join(claudeDir, dir.name);
        this.scanProjectDir(projectPath);
      }
    } catch {
      // Directory may not exist yet
    }

    // Check for dormant agents
    const now = Date.now();
    for (const [id, agent] of this.agents) {
      try {
        const stat = fs.statSync(agent.jsonlFile);
        if (now - stat.mtimeMs > AGENT_IDLE_TIMEOUT_MS) {
          this.agents.delete(id);
          this.knownFiles.delete(agent.jsonlFile);
          this.callbacks.onAgentDormant(id);
        }
      } catch {
        // File gone — agent is dead
        this.agents.delete(id);
        this.knownFiles.delete(agent.jsonlFile);
        this.callbacks.onAgentDormant(id);
      }
    }
  }

  private scanProjectDir(projectPath: string): void {
    try {
      const files = fs.readdirSync(projectPath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const fullPath = path.join(projectPath, file);

        // Skip already known files
        if (this.knownFiles.has(fullPath)) continue;

        // Check if recently active
        try {
          const stat = fs.statSync(fullPath);
          const age = Date.now() - stat.mtimeMs;
          if (age > AGENT_IDLE_TIMEOUT_MS) continue; // Too old

          // New active agent!
          const id = this.nextId++;
          const agent: AgentState = {
            id,
            projectDir: projectPath,
            jsonlFile: fullPath,
            fileOffset: 0,
            lineBuffer: '',
            activeToolIds: new Set(),
            activeToolStatuses: new Map(),
            activeToolNames: new Map(),
            activeSubagentToolIds: new Map(),
            activeSubagentToolNames: new Map(),
            isWaiting: false,
            permissionSent: false,
            hadToolsInTurn: false,
          };
          this.agents.set(id, agent);
          this.knownFiles.set(fullPath, id);
          this.callbacks.onAgentDiscovered(agent);
        } catch {
          // Can't stat — skip
        }
      }
    } catch {
      // Can't read dir — skip
    }
  }
}
```

**Step 2: Verify it compiles**

Run: `node esbuild.main.mjs`

**Step 3: Commit**

```bash
git add src/agentDiscovery.ts
git commit -m "feat: add agent auto-discovery via filesystem watching"
```

---

## Task 11: Create Settings Persistence

**Files:**
- Create: `src/settingsPersistence.ts`

**Step 1: Write settings persistence (replaces VS Code globalState)**

```typescript
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CONFIG_DIR, SETTINGS_FILE_NAME } from './constants.js';

export interface Settings {
  soundEnabled: boolean;
  alwaysOnTop: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number };
}

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  alwaysOnTop: false,
};

function getSettingsPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, SETTINGS_FILE_NAME);
}

export function readSettings(): Settings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: Settings): void {
  const dir = path.join(os.homedir(), CONFIG_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

export function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const settings = readSettings();
  settings[key] = value;
  writeSettings(settings);
}
```

**Step 2: Commit**

```bash
git add src/settingsPersistence.ts
git commit -m "feat: add settings persistence (replaces VS Code globalState)"
```

---

## Task 12: Implement Electron Main Process

**Files:**
- Modify: `src/main.ts` (replace placeholder)

**Step 1: Write the full Electron main process**

This is the core orchestrator, replacing `extension.ts` + `PixelAgentsViewProvider.ts`.

```typescript
import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AgentDiscovery } from './agentDiscovery.js';
import { startFileWatching } from './fileWatcher.js';
import { readLayoutFromFile, writeLayoutToFile, watchLayoutFile } from './layoutPersistence.js';
import {
  loadFurnitureAssets,
  loadFloorTiles,
  loadWallTiles,
  loadCharacterSprites,
  loadDefaultLayout,
} from './assetLoader.js';
import { readSettings, updateSetting } from './settingsPersistence.js';
import type { AgentState } from './types.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let discovery: AgentDiscovery | null = null;

function createWindow(): BrowserWindow {
  const settings = readSettings();

  const win = new BrowserWindow({
    width: settings.windowBounds?.width ?? 800,
    height: settings.windowBounds?.height ?? 600,
    x: settings.windowBounds?.x,
    y: settings.windowBounds?.y,
    alwaysOnTop: settings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Pixel Agents',
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Save window bounds on move/resize
  const saveBounds = () => {
    if (!win.isMinimized()) {
      updateSetting('windowBounds', win.getBounds());
    }
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  return win;
}

function send(channel: string, data?: unknown): void {
  mainWindow?.webContents.send(channel, data);
}

function setupIPC(): void {
  // Renderer → Main handlers
  ipcMain.on('saveLayout', (_event, layout) => {
    writeLayoutToFile(layout as Record<string, unknown>);
  });

  ipcMain.on('setSoundEnabled', (_event, data: { enabled: boolean }) => {
    updateSetting('soundEnabled', data.enabled);
  });

  ipcMain.on('saveAgentSeats', (_event, _seats) => {
    // Store seats — could persist to file if needed
  });

  ipcMain.on('exportLayout', async () => {
    const layout = readLayoutFromFile();
    if (!layout) return;
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      defaultPath: path.join(app.getPath('home'), 'pixel-agents-layout.json'),
    });
    if (result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(layout, null, 2), 'utf-8');
    }
  });

  ipcMain.on('importLayout', async () => {
    const result = await dialog.showOpenDialog({
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
      writeLayoutToFile(imported);
      send('layoutLoaded', { layout: imported });
    } catch {
      dialog.showErrorBox('Pixel Agents', 'Failed to read or parse layout file.');
    }
  });

  ipcMain.on('openSessionsFolder', () => {
    const claudeDir = path.join(app.getPath('home'), '.claude', 'projects');
    if (fs.existsSync(claudeDir)) {
      shell.openPath(claudeDir);
    }
  });

  ipcMain.on('webviewReady', async () => {
    // Send settings
    const settings = readSettings();
    send('settingsLoaded', { soundEnabled: settings.soundEnabled });

    // Load and send assets
    await loadAndSendAssets();

    // Start agent discovery
    startDiscovery();
  });
}

async function loadAndSendAssets(): Promise<void> {
  const assetsRoot = path.join(__dirname, '..', 'assets');

  try {
    const charSprites = await loadCharacterSprites(assetsRoot);
    if (charSprites) send('characterSpritesLoaded', charSprites);

    const floorTiles = await loadFloorTiles(assetsRoot);
    if (floorTiles) send('floorTilesLoaded', floorTiles);

    const wallTiles = await loadWallTiles(assetsRoot);
    if (wallTiles) send('wallTilesLoaded', wallTiles);

    const furniture = await loadFurnitureAssets(assetsRoot);
    if (furniture) send('furnitureAssetsLoaded', furniture);
  } catch (err) {
    console.error('Error loading assets:', err);
  }

  // Send layout
  const defaultLayout = loadDefaultLayout(path.join(__dirname, '..', 'assets'));
  const saved = readLayoutFromFile();
  send('layoutLoaded', { layout: saved ?? defaultLayout });

  // Watch for external layout changes
  watchLayoutFile((layout) => {
    send('layoutLoaded', { layout });
  });
}

function startDiscovery(): void {
  discovery = new AgentDiscovery({
    onAgentDiscovered: (agent: AgentState) => {
      send('agentCreated', { id: agent.id });

      // Start file watching for this agent
      startFileWatching(agent, (type, data) => {
        send(type, data);
      });
    },
    onAgentDormant: (agentId: number) => {
      send('agentClosed', { id: agentId });
    },
  });
  discovery.start();
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
  // On macOS, keep running in tray
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  discovery?.stop();
});
```

**Step 2: Build and verify**

Run: `node esbuild.main.mjs`
Expected: Compiles (may have import errors for not-yet-ported modules — that's expected)

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: implement Electron main process with IPC and discovery"
```

---

## Task 13: Adapt Renderer Message Handling

**Files:**
- Modify: `renderer/src/hooks/useExtensionMessages.ts`
- Modify: `renderer/src/App.tsx`
- Modify: `renderer/src/components/BottomToolbar.tsx`

**Step 1: Adapt useExtensionMessages.ts**

The hook currently uses `window.addEventListener('message', handler)`. Change to use the Electron IPC bridge.

Find the message listener setup (near the bottom of the file) and replace:

```typescript
// Old:
window.addEventListener('message', handler);
return () => window.removeEventListener('message', handler);

// New:
const channels = [
  'agentCreated', 'agentClosed', 'agentToolStart', 'agentToolDone',
  'agentToolsClear', 'agentStatus', 'agentSelected', 'agentToolPermission',
  'subagentToolStart', 'subagentToolDone', 'subagentClear', 'subagentToolPermission',
  'existingAgents', 'layoutLoaded', 'characterSpritesLoaded', 'floorTilesLoaded',
  'wallTilesLoaded', 'furnitureAssetsLoaded', 'settingsLoaded',
];
const cleanups = channels.map(channel =>
  window.electronAPI.on(channel, (data) => {
    handler({ data: { type: channel, ...(data as object) } } as MessageEvent);
  })
);
return () => cleanups.forEach(cleanup => cleanup());
```

The key insight: the existing handler processes `event.data.type` — we construct a fake MessageEvent with the same shape so the rest of the handler code works unchanged.

**Step 2: Adapt BottomToolbar.tsx**

Remove the "+ Agent" button (or repurpose it). Agents are auto-discovered.

**Step 3: Adapt App.tsx**

Replace `vscode.postMessage(...)` calls with `api.send(...)` calls. The `webviewReady` message should be sent on mount:

```typescript
// In useEffect on mount:
window.electronAPI.send('webviewReady');
```

**Step 4: Verify renderer compiles**

Run: `cd renderer && npx tsc --noEmit && cd ..`

**Step 5: Commit**

```bash
git add -u renderer/src/
git commit -m "feat: adapt renderer hooks and components for Electron IPC"
```

---

## Task 14: End-to-End Integration

**Files:**
- Modify: various files for integration fixes

**Step 1: Add renderer index.html entry for Electron**

Ensure `renderer/index.html` doesn't reference VS Code–specific scripts or CSP headers.

**Step 2: Test the full pipeline**

Run:
```bash
npm run build && npm start
```

Expected: Electron window opens, shows the pixel art office. If Claude Code is running, agents should appear.

**Step 3: Debug and fix any IPC message format mismatches**

Common issues:
- Message data wrapping (Electron sends data as first arg, not nested in `event.data`)
- Asset data serialization (large sprite arrays may need special handling)

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: end-to-end integration and fixes"
```

---

## Task 15: System Tray Integration

**Files:**
- Create: `src/tray.ts`
- Modify: `src/main.ts`

**Step 1: Create tray.ts**

```typescript
import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import * as path from 'path';

export function createTray(mainWindow: BrowserWindow): Tray {
  // Use a small icon — can be the app icon scaled down
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  const tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: mainWindow.isAlwaysOnTop(),
      click: (menuItem) => {
        mainWindow.setAlwaysOnTop(menuItem.checked);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('Pixel Agents');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  return tray;
}
```

**Step 2: Wire tray into main.ts**

Add `createTray(mainWindow)` call after window creation in `app.whenReady()`.

**Step 3: Commit**

```bash
git add src/tray.ts
git commit -m "feat: add system tray integration"
```

---

## Task 16: Build and Package Configuration

**Files:**
- Create: `electron-builder.yml`

**Step 1: Create electron-builder.yml**

```yaml
appId: com.pixelagents.desktop
productName: Pixel Agents
directories:
  output: release
files:
  - dist/**/*
  - "!dist/main/*.map"
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch:
        - arm64
        - x64
  icon: build/icon.icns
```

**Step 2: Test packaging**

Run: `npm run dist`
Expected: `release/` directory created with `.dmg` file

**Step 3: Commit**

```bash
git add electron-builder.yml
git commit -m "chore: add electron-builder packaging config"
```

---

## Summary of Execution Order

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Project scaffolding | None |
| 2 | Copy renderer from pixel-agents | Task 1 |
| 3 | Create preload bridge | Task 1 |
| 4 | Replace vscodeApi with electronApi | Task 2, 3 |
| 5 | Port types and constants | Task 1 |
| 6 | Copy platform-independent modules | Task 5 |
| 7 | Port layoutPersistence | Task 5 |
| 8 | Port assetLoader | Task 5 |
| 9 | Port fileWatcher | Task 5 |
| 10 | Create agent discovery | Task 5 |
| 11 | Create settings persistence | Task 5 |
| 12 | Implement Electron main process | Tasks 7-11 |
| 13 | Adapt renderer message handling | Tasks 4, 12 |
| 14 | End-to-end integration | Tasks 12, 13 |
| 15 | System tray | Task 14 |
| 16 | Build and package | Task 14 |

Tasks 5-11 can be parallelized (independent backend modules).
Tasks 3 and 4 can run in parallel.
