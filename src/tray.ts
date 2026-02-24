import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron';

export function createTray(mainWindow: BrowserWindow): Tray {
  // Create a simple 16x16 tray icon (white pixel character silhouette on transparent)
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);

  // Draw a minimal character shape (head + body)
  const set = (x: number, y: number) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const idx = (y * size + x) * 4;
      buf[idx] = 255;     // R
      buf[idx + 1] = 255; // G
      buf[idx + 2] = 255; // B
      buf[idx + 3] = 255; // A
    }
  };

  // Head (4x4 at center-top)
  for (let y = 2; y < 6; y++)
    for (let x = 6; x < 10; x++) set(x, y);
  // Body (6x5 below head)
  for (let y = 6; y < 11; y++)
    for (let x = 5; x < 11; x++) set(x, y);
  // Legs
  for (let y = 11; y < 14; y++) {
    set(6, y); set(7, y);
    set(9, y); set(10, y);
  }

  const icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
  const tray = new Tray(icon);

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: mainWindow.isVisible() ? 'Hide' : 'Show',
        click: () => {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
          updateMenu();
        },
      },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: mainWindow.isAlwaysOnTop(),
        click: (menuItem) => {
          mainWindow.setAlwaysOnTop(menuItem.checked);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]);
    tray.setContextMenu(contextMenu);
  };

  tray.setToolTip('Pixel Agents');
  updateMenu();

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
    updateMenu();
  });

  // Update menu when window visibility changes
  mainWindow.on('show', updateMenu);
  mainWindow.on('hide', updateMenu);

  return tray;
}
