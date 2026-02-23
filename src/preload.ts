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
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },
  once(channel: string, callback: MessageCallback): void {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
