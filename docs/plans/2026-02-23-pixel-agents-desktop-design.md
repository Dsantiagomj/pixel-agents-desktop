# Pixel Agents Desktop — Design Document

## Overview

Standalone Electron desktop app that visualizes Claude Code AI agents as animated pixel art characters in a virtual office. Editor-agnostic — works with Zed, VS Code, terminal, or any environment running Claude Code.

Fork of [pixel-agents](https://github.com/pablodelucca/pixel-agents) (VS Code extension) adapted as a standalone desktop app with auto-discovery of agents via filesystem watching.

## Goals

- Decouple pixel-agents from VS Code into a standalone Electron app
- Auto-detect Claude Code sessions from any editor/terminal
- Preserve all features: animated agents, office editor, sub-agents, sound notifications
- Maximize code reuse from the original pixel-agents webview-ui

## Architecture

### High-Level

```
~/.claude/projects/**/*.jsonl
        │
        ▼
  agentDiscovery.ts  (detects new JSONL files)
        │
        ▼
  fileWatcher.ts  (watches for changes in JSONL)
        │
        ▼
  transcriptParser.ts  (parses tool_use, status)
        │
        ▼
  ipc.ts  (ipcMain.send → ipcRenderer.on)
        │
        ▼
  useExtensionMessages.ts  (dispatches to OfficeState)
        │
        ▼
  Canvas 2D  (renders characters, office, animations)
```

### Project Structure

```
pixel-agents-desktop/
├── src/                          # Electron main process (NEW)
│   ├── main.ts                   # Entry point, BrowserWindow
│   ├── agentDiscovery.ts         # Auto-detect Claude Code sessions
│   ├── fileWatcher.ts            # Watch JSONL files (adapted)
│   ├── transcriptParser.ts       # Parse JSONL → events (reused)
│   ├── timerManager.ts           # Idle/permission detection (reused)
│   ├── ipc.ts                    # IPC bridge (replaces VS Code postMessage)
│   ├── tray.ts                   # System tray integration
│   └── types.ts                  # Shared types (reused)
│
├── webview-ui/                   # Game frontend (REUSED from pixel-agents)
│   ├── src/
│   │   ├── App.tsx               # Root component (adapted)
│   │   ├── electronApi.ts        # IPC wrapper (replaces vscodeApi.ts)
│   │   ├── office/               # Game engine (100% reused)
│   │   │   ├── engine/           # officeState, characters, gameLoop, renderer
│   │   │   ├── editor/           # Layout editor
│   │   │   ├── layout/           # Furniture catalog, pathfinding
│   │   │   └── sprites/          # Sprite data, cache, colorize
│   │   ├── components/           # UI components (adapted)
│   │   └── hooks/                # Message handlers (adapted for IPC)
│   └── public/assets/            # Sprites, layouts, fonts
│
├── electron-builder.yml          # Packaging config
├── package.json
└── tsconfig.json
```

## Agent Discovery (New System)

Replaces VS Code terminal-based agent management with filesystem auto-discovery.

### Strategy

1. **Initial scan** — On startup, recursively scan `~/.claude/projects/` for `.jsonl` files
2. **Continuous watch** — `fs.watch` recursive on `~/.claude/projects/` to detect new files
3. **Activity filter** — Only consider "active" JSONL files with `mtime` < 30 seconds (configurable)
4. **Lifecycle** — If a JSONL receives no new writes for X minutes, the agent is marked as "dormant" and the character plays despawn animation

### Identity Resolution

- Each JSONL has a session-id in its filename
- The path contains the project hash, providing "office" context (each project = a room)
- When an agent disappears and reappears (new session), a new character is assigned

### Comparison with pixel-agents

| Aspect | pixel-agents (VS Code) | pixel-agents-desktop |
|---|---|---|
| Discovery | Manual (click + Agent) | Auto (filesystem watch) |
| Scope | VS Code terminals only | Any Claude Code on the system |
| Identity | Terminal UUID | Session JSONL filename |
| Lifecycle | Terminal open/close | File activity timeout |

## Frontend Adaptation

The webview-ui from pixel-agents is reused nearly 100%.

### Unchanged (direct copy)

- `office/engine/` — officeState, characters FSM, gameLoop, renderer, matrixEffect
- `office/editor/` — editorActions, editorState, EditorToolbar
- `office/layout/` — furnitureCatalog, layoutSerializer, tileMap (pathfinding)
- `office/sprites/` — spriteData, spriteCache, colorize
- `office/types.ts`, `colorize.ts`, `floorTiles.ts`, `wallTiles.ts`
- `public/assets/` — All sprites, fonts, default layout

### Adapted

1. **`vscodeApi.ts` → `electronApi.ts`**
   - `vscode.postMessage()` → `window.electronAPI.send()`
   - VS Code theming CSS vars → Custom theme or Electron native

2. **`useExtensionMessages.ts`** — Change listener:
   - `window.addEventListener('message')` → `window.electronAPI.on()`
   - Message types remain identical

3. **`BottomToolbar.tsx`** — Remove "+ Agent" button (auto-discovery handles it), keep "Layout" and "Settings"

4. **`App.tsx`** — Remove VS Code API references, adapt to Electron window

### IPC Communication

```typescript
// Main process (replaces VS Code extension host)
mainWindow.webContents.send('agentCreated', { id, name });
mainWindow.webContents.send('agentToolStart', { id, toolId, status });

// Renderer process (replaces VS Code webview)
window.electronAPI.on('agentCreated', (data) => { ... });
window.electronAPI.send('saveLayout', layout);
```

## Features (MVP)

### Core: Animated Agents + Tracking
- Pixel art characters appear when Claude Code agents are detected
- Characters animate based on real agent state:
  - **Writing tools** (Write, Edit, Bash) → typing animation
  - **Reading tools** (Read, Grep, Glob, WebFetch, WebSearch) → reading animation
  - **Idle** → wander around the office
  - **Waiting for input** → speech bubble with checkmark
  - **Permission needed** → speech bubble with "..."

### Office Editor + Layout
- Drag-and-drop editor for designing office with furniture, floors, walls
- Persistent layouts saved to `~/.pixel-agents/layout.json`
- Compatible with original pixel-agents layout format

### Sub-Agents (Task Tool)
- When an agent uses the Task tool, child characters spawn with Matrix rain animation
- Sub-agents linked to parent, despawn when parent task completes

### Sound + Notifications
- Chime when an agent's turn completes (ascending two-note E5→E6)
- System tray notification when an agent needs permission

## Packaging & Distribution

### Electron Builder
- macOS: `.dmg` / `.app`
- Auto-updater optional (electron-updater)

### Window Behavior
- System tray with context menu (Show/Hide, Quit)
- Always-on-top toggle
- Free resize, office adapts to window size
- Remember window size/position between sessions

### Persistent Configuration
- Layout: `~/.pixel-agents/layout.json` (compatible with original pixel-agents)
- Settings: `~/.pixel-agents/config.json` (sound, always-on-top, etc.)

## Tech Stack

- **Electron** (main process: Node.js, renderer: Chromium)
- **React 19** (UI components)
- **Vite** (frontend bundling)
- **TypeScript 5.x** (strict mode)
- **Canvas 2D** (game rendering)
- **Web Audio API** (notification sounds)
- **electron-builder** (packaging)
