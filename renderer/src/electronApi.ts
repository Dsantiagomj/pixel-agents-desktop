interface ElectronAPI {
  send(channel: string, data?: unknown): void;
  on(channel: string, callback: (...args: unknown[]) => void): () => void;
  once(channel: string, callback: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export const api = window.electronAPI;
