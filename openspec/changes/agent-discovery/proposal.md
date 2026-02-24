# Proposal: Agent Discovery

## Intent

The app renders the office perfectly but shows no agent characters. We need to auto-detect running Claude Code sessions from any editor/terminal by watching `~/.claude/projects/**/*.jsonl` files, parse JSONL transcripts for tool activity, and send real-time events to the renderer so characters appear and animate.

## Scope

### In Scope
- Backend types and constants (AgentState, timing values)
- JSONL transcript parser (tool_use/tool_result → events)
- File watcher (per-agent JSONL watching with partial line buffering)
- Agent discovery system (scan + watch `~/.claude/projects/` for active sessions)
- Timer manager (idle detection, permission detection)
- Wire everything into main.ts IPC handlers

### Out of Scope
- Terminal spawning (no node-pty, pure read-only discovery)
- System tray integration (separate change)
- Packaging/distribution (separate change)
- Layout persistence module (already working inline in main.ts)

## Approach

Port `transcriptParser.ts`, `timerManager.ts`, and `fileWatcher.ts` from the original pixel-agents repo, removing VS Code dependencies. Create new `agentDiscovery.ts` that scans `~/.claude/projects/` for recently-active `.jsonl` files and registers them as agents. When a new agent is discovered, start file watching → parse transcript → send IPC events to renderer.

Key architecture:
```
AgentDiscovery (scan for new JSONL files)
    ↓ onAgentDiscovered
FileWatcher (watch individual JSONL, read new lines)
    ↓ new lines
TranscriptParser (parse tool_use, tool_result, system records)
    ↓ events
TimerManager (idle/permission detection)
    ↓ timed events
IPC send() → renderer
```

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/types.ts` | New | AgentState, PersistedAgent interfaces |
| `src/constants.ts` | New | Timing values, discovery config, display limits |
| `src/transcriptParser.ts` | New (ported) | JSONL parsing logic |
| `src/timerManager.ts` | New (ported) | Idle/permission timer logic |
| `src/fileWatcher.ts` | New (adapted) | File watching, remove VS Code terminal adoption |
| `src/agentDiscovery.ts` | New | Filesystem scanning for active sessions |
| `src/main.ts` | Modified | Wire discovery + file watching into IPC |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| transcriptParser imports differ | Medium | Check imports, adapt to local constants.ts |
| fileWatcher has VS Code terminal refs | High | Remove terminal adoption, use callback pattern |
| JSONL format changes between Claude versions | Low | Parser is field-tolerant, logs unknown types |
| Performance with many JSONL files | Low | Only watch recently-active files (mtime filter) |

## Rollback Plan

Revert the changes to main.ts. All new files are additive — removing them restores the current behavior (office renders, no agents).

## Success Criteria

- [ ] Running Claude Code session appears as animated character in the office
- [ ] Character animates based on tool activity (typing for Write/Edit, reading for Read/Grep)
- [ ] Character shows waiting bubble when agent turn completes
- [ ] Agent despawns when session goes idle (5min no writes)
- [ ] Multiple simultaneous agents each get their own character
