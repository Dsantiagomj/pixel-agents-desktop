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
    const claudeDir = path.join(os.homedir(), CLAUDE_PROJECTS_DIR);
    if (!fs.existsSync(claudeDir)) return;

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

        if (this.knownFiles.has(fullPath)) continue;

        try {
          const stat = fs.statSync(fullPath);
          const age = Date.now() - stat.mtimeMs;
          if (age > AGENT_IDLE_TIMEOUT_MS) continue;

          const id = this.nextId++;
          const agent: AgentState = {
            id,
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
          console.log(`[Pixel Agents] Agent ${id} discovered: ${path.basename(fullPath)}`);
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
