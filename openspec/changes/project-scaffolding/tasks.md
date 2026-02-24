# Tasks: Project Scaffolding

## Phase 1: Infrastructure

- [x] 1.1 Create `package.json` with Electron, esbuild, concurrently, typescript, pngjs dependencies and dev/build/start scripts
- [x] 1.2 Create `tsconfig.main.json` for Electron main process (target ES2022, strict, erasableSyntaxOnly, verbatimModuleSyntax)
- [x] 1.3 Create root `tsconfig.json` with project references to `tsconfig.main.json` and `renderer/`
- [x] 1.4 Create `esbuild.main.mjs` — bundles `src/main.ts` and `src/preload.ts` to `dist/main/`, copies `renderer/public/assets/` to `dist/assets/`, supports `--watch` flag
- [x] 1.5 Run `npm install`, verify no errors
- [x] 1.6 Commit: `chore: add root project config and build system`

## Phase 2: Renderer Copy and Adaptation

- [x] 2.1 Copy `/Users/danielmunoz/Develop/personal/pixel-agents/webview-ui/` to `renderer/`
- [x] 2.2 Delete `renderer/node_modules/` and `renderer/dist/` if copied
- [x] 2.3 Update `renderer/package.json`: change name to `pixel-agents-renderer`
- [x] 2.4 Update `renderer/vite.config.ts`: change `outDir` to `../dist/renderer`
- [x] 2.5 Run `cd renderer && npm install`, verify no errors
- [x] 2.6 Commit: `feat: copy renderer from pixel-agents webview-ui`

## Phase 3: IPC Bridge

- [x] 3.1 Create `src/preload.ts` — expose `window.electronAPI` via `contextBridge` with `send(channel, data)`, `on(channel, callback)` returning cleanup function, and `once(channel, callback)`
- [x] 3.2 Create `renderer/src/electronApi.ts` — declare global `Window.electronAPI` type, export `api` object
- [x] 3.3 Delete `renderer/src/vscodeApi.ts`
- [x] 3.4 Update `renderer/src/App.tsx` — replace `import { vscode } from './vscodeApi.js'` with `import { api } from './electronApi.js'`, replace 3 `vscode.postMessage({type: X, ...})` calls with `api.send(X, {...})`
- [x] 3.5 Update `renderer/src/components/SettingsModal.tsx` — replace import and 4 `vscode.postMessage()` calls with `api.send()`
- [x] 3.6 Update `renderer/src/components/DebugView.tsx` — replace import and 1 `vscode.postMessage()` call with `api.send()`
- [x] 3.7 Update `renderer/src/hooks/useExtensionMessages.ts` — replace import, replace 2 `vscode.postMessage()` calls with `api.send()`, replace `window.addEventListener('message', handler)` with `electronAPI.on()` calls per channel
- [x] 3.8 Update `renderer/src/hooks/useEditorActions.ts` — replace import and 3 `vscode.postMessage()` calls with `api.send()`
- [x] 3.9 Update `renderer/src/office/components/OfficeCanvas.tsx` — replace import and 1 `vscode.postMessage()` call with `api.send()`
- [x] 3.10 Verify no `vscodeApi` imports remain: `rg "vscodeApi|acquireVsCodeApi" renderer/src/` should return nothing
- [x] 3.11 Commit: `refactor: replace vscodeApi with electronApi IPC bridge`

## Phase 4: Electron Main Process

- [x] 4.1 Create `src/main.ts` — minimal Electron entry: `app.whenReady()`, create `BrowserWindow` with preload, load `dist/renderer/index.html` (prod) or `http://localhost:5173` (dev via `ELECTRON_DEV` env var), handle `window-all-closed` and `activate` events
- [x] 4.2 Add stub IPC handlers in `src/main.ts` for messages the renderer sends on startup: `webviewReady` (respond with `settingsLoaded`), `saveLayout`, `setSoundEnabled`, `saveAgentSeats`, `exportLayout`, `importLayout`, `openSessionsFolder`
- [x] 4.3 Build main process: `node esbuild.main.mjs`, verify `dist/main/main.js` and `dist/main/preload.js` exist
- [x] 4.4 Commit: `feat: implement minimal Electron main process`

## Phase 5: Integration and Verification

- [x] 5.1 Build renderer: `cd renderer && npm run build`
- [x] 5.2 Build main: `node esbuild.main.mjs`
- [x] 5.3 Run `npx electron .` — verify window opens
- [x] 5.4 Debug and fix any asset loading issues (paths, CSP, file:// protocol) — Created `src/assetLoader.ts`, integrated into `webviewReady` handler. Copied floors.png and furniture/ from installed VS Code extension.
- [x] 5.5 Debug and fix any IPC message format mismatches between main and renderer — Assets sent in correct order: chars → floors → walls → furniture → settings → layout
- [x] 5.6 Verify the office canvas renders with default layout (floor tiles, walls, furniture visible) — All 92 furniture assets + 7 floor patterns + 16 wall tiles + 6 character sprites loaded
- [ ] 5.7 Verify no console errors related to missing VS Code API
- [ ] 5.8 Commit: `feat: end-to-end scaffolding working`
