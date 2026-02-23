# Proposal: Project Scaffolding

## Intent

Bootstrap the pixel-agents-desktop project from zero to a running Electron app that loads the pixel-agents renderer (Canvas 2D office). This is the foundation that everything else builds on — without it, nothing works.

Covers Tasks 1–4 from the implementation plan: project config, renderer copy, preload bridge, and electronApi adapter.

## Scope

### In Scope
- Root `package.json` with Electron + build scripts
- TypeScript config (root, main process)
- esbuild config for main process bundling
- Copy renderer (webview-ui) from pixel-agents with adapted Vite config
- Electron preload bridge (`src/preload.ts`) with contextBridge IPC
- `renderer/src/electronApi.ts` replacing `vscodeApi.ts`
- Minimal `src/main.ts` that opens a BrowserWindow loading the renderer
- Verify the app launches and shows the office canvas (even without agents)

### Out of Scope
- Agent discovery and JSONL file watching (next change)
- Backend modules (transcriptParser, timerManager, layoutPersistence, assetLoader)
- System tray integration
- Packaging / electron-builder config
- Tests (no test infra yet)

## Approach

1. Create root project config files (package.json, tsconfig, esbuild)
2. Copy `pixel-agents/webview-ui/` as `renderer/`, adapt Vite output to `dist/renderer/`
3. Create preload bridge exposing `window.electronAPI` with `send()` and `on()` methods
4. Replace `vscodeApi.ts` with `electronApi.ts` in renderer — swap `vscode.postMessage()` → `api.send()`
5. Write minimal `main.ts` that creates a BrowserWindow, loads `dist/renderer/index.html`, and wires the preload
6. Verify the app starts and renders the office (assets load from bundled path)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | New | Root project dependencies and scripts |
| `tsconfig.json` | New | Project references (main + renderer) |
| `tsconfig.main.json` | New | Main process TypeScript config |
| `esbuild.main.mjs` | New | Main process bundler with asset copy |
| `src/main.ts` | New | Electron entry point (main process) |
| `src/preload.ts` | New | IPC bridge via contextBridge |
| `renderer/` | New | Copied from pixel-agents/webview-ui/ |
| `renderer/src/electronApi.ts` | New | Replaces vscodeApi.ts |
| `renderer/src/vscodeApi.ts` | Removed | VS Code API no longer used |
| `renderer/vite.config.ts` | Modified | Output to `../dist/renderer` |
| `renderer/package.json` | Modified | Rename to pixel-agents-renderer |

**IPC protocol impact:** This change establishes the IPC message protocol. The preload bridge defines the contract between main and renderer processes.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Renderer import errors after removing vscodeApi | Medium | Compile check after each replacement, fix incrementally |
| Asset paths wrong in Electron context | Medium | Test with both dev (vite dev server) and prod (file:// protocol) |
| Electron security warnings (CSP, nodeIntegration) | Low | Use contextIsolation + preload, no nodeIntegration |

## Rollback Plan

Delete all created files and the `renderer/` directory. The project returns to its current state (only docs and openspec).

```bash
rm -rf src/ renderer/ package.json tsconfig.json tsconfig.main.json esbuild.main.mjs node_modules/
```

## Dependencies

- Node.js 22+ installed
- `/Users/danielmunoz/Develop/personal/pixel-agents/webview-ui/` available to copy from

## Success Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles both main process and renderer
- [ ] `npm start` opens an Electron window
- [ ] The pixel art office renders in the window (floor, walls, furniture from default layout)
- [ ] No VS Code API imports remain in the codebase
- [ ] `renderer/src/electronApi.ts` exposes `send()` and `on()` via `window.electronAPI`
