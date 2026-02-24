import electronUpdater, { type AppUpdater } from 'electron-updater';
import type { BrowserWindow } from 'electron';

function getAutoUpdater(): AppUpdater {
  const { autoUpdater } = electronUpdater;
  return autoUpdater;
}

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  const autoUpdater = getAutoUpdater();

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (data: Record<string, unknown>) => {
    mainWindow.webContents.send('updateStatus', data);
  };

  autoUpdater.on('update-available', (info) => {
    send({ status: 'available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    send({ status: 'downloading', percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send({ status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    console.error('[Pixel Agents] Auto-update error:', error.message);
  });

  // Check for updates 5s after launch
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[Pixel Agents] Update check failed:', err.message);
    });
  }, 5000);
}

export function quitAndInstall(): void {
  const autoUpdater = getAutoUpdater();
  autoUpdater.quitAndInstall(false, true);
}
