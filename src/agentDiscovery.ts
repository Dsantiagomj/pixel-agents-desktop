import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CLAUDE_PROJECTS_DIR,
  CODEX_SESSIONS_DIR,
  DISCOVERY_SCAN_INTERVAL_MS,
  AGENT_IDLE_TIMEOUT_MS,
} from './constants.js';
import type { AgentState, AgentType } from './types.js';

export interface DiscoveryCallbacks {
  onAgentDiscovered: (agent: AgentState) => void;
  onAgentDormant: (agentId: number) => void;
}

export class AgentDiscovery {
  private agents = new Map<number, AgentState>();
  private knownFiles = new Map<string, number>();
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

  getAgentIds(): number[] {
    return [...this.agents.keys()];
  }

  private scan(): void {
    // Scan Claude Code projects
    const claudeDir = path.join(os.homedir(), CLAUDE_PROJECTS_DIR);
    if (fs.existsSync(claudeDir)) {
      try {
        const projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true });
        for (const dir of projectDirs) {
          if (!dir.isDirectory()) continue;
          this.scanDirForJsonl(path.join(claudeDir, dir.name), 'claude');
        }
      } catch {
        // Directory may not exist yet
      }
    }

    // Scan Codex sessions (recursive date-based: YYYY/MM/DD/)
    const codexDir = path.join(os.homedir(), CODEX_SESSIONS_DIR);
    if (fs.existsSync(codexDir)) {
      this.scanCodexSessionsRecursive(codexDir);
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

  private scanCodexSessionsRecursive(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.scanCodexSessionsRecursive(fullPath);
        } else if (entry.name.endsWith('.jsonl')) {
          this.tryRegisterJsonl(fullPath, dir, 'codex');
        }
      }
    } catch {
      // Can't read dir — skip
    }
  }

  private scanDirForJsonl(projectPath: string, agentType: AgentType): void {
    try {
      const files = fs.readdirSync(projectPath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        this.tryRegisterJsonl(path.join(projectPath, file), projectPath, agentType);
      }
    } catch {
      // Can't read dir — skip
    }
  }

  private tryRegisterJsonl(fullPath: string, projectPath: string, agentType: AgentType): void {
    if (this.knownFiles.has(fullPath)) return;

    try {
      const stat = fs.statSync(fullPath);
      const age = Date.now() - stat.mtimeMs;
      if (age > AGENT_IDLE_TIMEOUT_MS) return;

      const id = this.nextId++;
      const agent: AgentState = {
        id,
        agentType,
        projectDir: projectPath,
        jsonlFile: fullPath,
        fileOffset: stat.size, // Start from end — only track new activity
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
      console.log(`[Pixel Agents] ${agentType} agent ${id} discovered: ${path.basename(fullPath)}`);
      this.callbacks.onAgentDiscovered(agent);
    } catch {
      // Can't stat — skip
    }
  }
}
