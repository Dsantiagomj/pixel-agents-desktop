import electronUpdater, { type AppUpdater } from 'electron-updater';
import { app, shell, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const isMac = process.platform === 'darwin';

const RELEASE_URL = 'https://github.com/Dsantiagomj/pixel-agents-desktop/releases/latest';

function logToFile(message: string): void {
  try {
    const logDir = app.getPath('logs');
    const logFile = path.join(logDir, 'auto-update.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch {
    // Silently ignore logging failures
  }
}

function getAutoUpdater(): AppUpdater {
  const { autoUpdater } = electronUpdater;
  return autoUpdater;
}

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  const autoUpdater = getAutoUpdater();

  // On macOS without code signing, Squirrel.Mac can't install updates.
  // We disable auto-download and just notify the user with a download link.
  autoUpdater.autoDownload = !isMac;
  autoUpdater.autoInstallOnAppQuit = !isMac;

  const send = (data: Record<string, unknown>) => {
    mainWindow.webContents.send('updateStatus', data);
  };

  autoUpdater.on('checking-for-update', () => {
    logToFile('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    logToFile(`Update available: ${info.version}`);
    if (isMac) {
      // On macOS, notify with download link only (no Squirrel.Mac install)
      send({ status: 'available', version: info.version, releaseUrl: RELEASE_URL });
    } else {
      send({ status: 'available', version: info.version });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    logToFile(`No update available. Current: ${app.getVersion()}, Latest: ${info.version}`);
  });

  autoUpdater.on('download-progress', (progress) => {
    logToFile(`Download progress: ${progress.percent.toFixed(1)}%`);
    send({ status: 'downloading', percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logToFile(`Update downloaded: ${info.version}`);
    send({ status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    logToFile(`Auto-update error: ${error.message}\n${error.stack || ''}`);
    console.error('[Pixel Agents] Auto-update error:', error.message);
  });

  // Check for updates 5s after launch
  setTimeout(() => {
    logToFile(`Checking for updates (current: ${app.getVersion()}, platform: ${process.platform}, arch: ${process.arch})`);
    autoUpdater.checkForUpdates().catch((err: Error) => {
      logToFile(`Update check failed: ${err.message}\n${err.stack || ''}`);
      console.error('[Pixel Agents] Update check failed:', err.message);
    });
  }, 5000);
}

export function quitAndInstall(): void {
  const autoUpdater = getAutoUpdater();
  autoUpdater.quitAndInstall(false, true);
}

export function openReleaseUrl(): void {
  shell.openExternal(RELEASE_URL);
}
