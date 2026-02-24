# Pixel Agents Desktop

Standalone Electron desktop app that visualizes **Claude Code** AI agents as animated pixel art characters in a virtual office.

![Electron](https://img.shields.io/badge/Electron-35-47848F?logo=electron)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![License](https://img.shields.io/badge/License-MIT-green)

## About

This project is a standalone desktop adaptation of the [pixel-agents](https://github.com/pablodelucca/pixel-agents) VS Code extension by [@pablodelucca](https://github.com/pablodelucca). While the original extension only works inside VS Code, **Pixel Agents Desktop** runs as an independent Electron app — making it editor-agnostic. It works with Zed, VS Code, terminal, or any environment running Claude Code.

## Key Differences from the VS Code Extension

| Aspect | pixel-agents (VS Code) | pixel-agents-desktop (Electron) |
|---|---|---|
| **Runtime** | VS Code extension | Standalone Electron app |
| **Agent Discovery** | Manual — click "+ Agent" button | Automatic — watches `~/.claude/projects/` filesystem |
| **Scope** | VS Code terminals only | Any Claude Code session on the system |
| **Agent Identity** | Terminal UUID | Session JSONL filename |
| **Agent Lifecycle** | Terminal open/close events | File activity timeout (5 min idle = dormant) |
| **IPC** | VS Code `postMessage` API | Electron IPC (contextBridge) |
| **Packaging** | `.vsix` extension | `.dmg` / `.exe` / `.AppImage` native app |
| **System Tray** | N/A | System tray with show/hide, always-on-top |
| **Window Behavior** | VS Code webview panel | Free-resize window, remembers position |

### What Changed

- **Removed**: All `vscode` API dependencies — no `vscode.Terminal`, `vscode.Webview`, `vscode.ExtensionContext`
- **Added**: `agentDiscovery.ts` — auto-discovers active Claude Code sessions by scanning `~/.claude/projects/**/*.jsonl` files
- **Added**: `src/tray.ts` — system tray integration with context menu
- **Replaced**: `vscodeApi.ts` → `electronApi.ts` (IPC bridge via `contextBridge`)
- **Replaced**: `agentManager.ts` (terminal-based) → `agentDiscovery.ts` (filesystem-based)
- **Adapted**: `useExtensionMessages.ts` — listens on Electron IPC channels instead of `window.addEventListener('message')`
- **Preserved**: 100% of the game engine — `officeState`, characters FSM, `gameLoop`, renderer, sprites, editor, pathfinding, furniture catalog

### What Stayed the Same

The entire rendering engine and game logic from the original pixel-agents is preserved:

- Animated pixel art characters with state-based animations (typing, reading, idle, waiting)
- Virtual office with drag-and-drop furniture editor
- Sub-agent spawning with Matrix rain animation (Task tool)
- Sound notifications (Web Audio API chimes)
- Layout persistence and import/export
- Sprite colorization and character assignment

## Architecture

```
~/.claude/projects/**/*.jsonl
        |
        v
  agentDiscovery.ts  ──> detects new JSONL files
        |
        v
  fileWatcher.ts     ──> watches for changes in JSONL
        |
        v
  transcriptParser.ts ──> parses tool_use events, status
        |
        v
  Electron IPC       ──> ipcMain.send → ipcRenderer.on
        |
        v
  React + Canvas 2D  ──> renders characters, office, animations
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- Claude Code installed and running (sessions create JSONL files in `~/.claude/projects/`)

### Install

```bash
git clone https://github.com/Dsantiagomj/pixel-agents-desktop.git
cd pixel-agents-desktop
npm install
cd renderer && npm install && cd ..
```

### Development

```bash
npm run dev
```

This starts both the Electron main process (with esbuild watch) and the Vite dev server for the renderer.

### Build

```bash
npm run build
npm start
```

### Package for Distribution

```bash
npm run dist
```

Outputs to `release/` — produces `.dmg` on macOS, `.exe` on Windows, `.AppImage` on Linux.

## Tech Stack

- **Electron 35** — main process (Node.js) + renderer (Chromium)
- **React 19** — UI components
- **Vite 7** — frontend bundling
- **TypeScript 5.9** — strict mode
- **Canvas 2D** — game rendering
- **Web Audio API** — notification sounds
- **esbuild** — main process bundling
- **electron-builder** — packaging and distribution

## How It Works

1. **Agent Discovery**: On startup, scans `~/.claude/projects/` for `.jsonl` transcript files. Continuously watches for new files.
2. **Activity Tracking**: Parses JSONL entries to detect tool usage (`Write`, `Edit`, `Bash`, `Read`, `Grep`, etc.) and maps them to character animations.
3. **Character Animation**: Each discovered agent gets a pixel art character that reflects their real-time state:
   - **Writing tools** (Write, Edit, Bash) → typing animation
   - **Reading tools** (Read, Grep, Glob, WebFetch) → reading animation
   - **Idle** → wander around the office
   - **Waiting for input** → speech bubble with checkmark
   - **Permission needed** → speech bubble with "..."
4. **Sub-agents**: When an agent uses the Task tool, child characters spawn with a Matrix rain effect.
5. **Dormancy**: If a session has no JSONL writes for 5 minutes, the character plays a despawn animation and is removed.

## Credits

- Original [pixel-agents](https://github.com/pablodelucca/pixel-agents) VS Code extension by [Pablo de Lucca](https://github.com/pablodelucca)
- Desktop adaptation by [Daniel Santiago](https://github.com/Dsantiagomj)

## License

MIT
