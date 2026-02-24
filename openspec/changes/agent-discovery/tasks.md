# Tasks: Agent Discovery

## Phase 1: Backend Types and Constants

- [x] 1.1 Create `src/constants.ts` — timing values, display truncation, discovery config
- [x] 1.2 Create `src/types.ts` — `AgentState` (no vscode.Terminal), `IpcBridge` type
- [x] 1.3 Verify build: `node esbuild.main.mjs`

## Phase 2: Port Platform-Independent Modules

- [x] 2.1 Port `src/timerManager.ts` — replaced vscode.Webview with IpcBridge, bridge?.send() pattern
- [x] 2.2 Port `src/transcriptParser.ts` — replaced vscode.Webview with IpcBridge, all postMessage → bridge?.send()
- [x] 2.3 Verify build: `node esbuild.main.mjs`

## Phase 3: File Watcher

- [x] 3.1 Port `src/fileWatcher.ts` — removed ensureProjectScan, reassignAgentToFile, terminal adoption. Added stopFileWatching(). Kept startFileWatching + readNewLines with IpcBridge.
- [x] 3.2 Verify build: `node esbuild.main.mjs`

## Phase 4: Agent Discovery System

- [x] 4.1 Create `src/agentDiscovery.ts` — scans ~/.claude/projects/, tracks known files, assigns IDs, onAgentDiscovered/onAgentDormant callbacks. Starts from end of file (fileOffset = stat.size) to avoid replaying history.
- [x] 4.2 Verify build: `node esbuild.main.mjs`

## Phase 5: Wire Into Main Process

- [x] 5.1 Update `src/main.ts` — import AgentDiscovery, IpcBridge, startFileWatching/stopFileWatching/readNewLines. Start discovery after layoutLoaded. Wire onAgentDiscovered → agentCreated + startFileWatching. Wire onAgentDormant → agentClosed + stopFileWatching.
- [x] 5.2 Ensure proper cleanup — stopDiscovery() on before-quit clears all watchers and timers
- [x] 5.3 Build and launch: verified — Agent 1 discovered from this Claude Code session (e2d374ca-317c-4160-8434-87eb68fb2f1d.jsonl)
- [ ] 5.4 Verify tool animations — character should type when agent uses Write/Edit/Bash, read when using Read/Grep
- [ ] 5.5 Verify idle/waiting detection — character shows waiting bubble when agent turn completes
- [ ] 5.6 Commit: `feat: add agent auto-discovery via JSONL watching`
