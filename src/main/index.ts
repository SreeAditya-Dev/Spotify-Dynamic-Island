import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { MediaManager } from './services/mediaManager';
import { MediaCommand } from '../types/media';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance optimizations for ultra-low RAM and butter-smooth 120fps rendering
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

let mainWindow: BrowserWindow | null = null;
let mediaManager: MediaManager | null = null;
let tray: Tray | null = null;
let isPinned = false;
let isQuitting = false;

const COLLAPSED_WIDTH = 260;
const COLLAPSED_HEIGHT = 50;
const EXPANDED_WIDTH = 480;
const EXPANDED_HEIGHT = 225;

function expandWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;
  const posX = Math.round((screenWidth - EXPANDED_WIDTH) / 2);
  mainWindow.setBounds({
    x: posX,
    y: 4,
    width: EXPANDED_WIDTH,
    height: EXPANDED_HEIGHT
  });
}

function collapseWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || isPinned) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;
  const posX = Math.round((screenWidth - COLLAPSED_WIDTH) / 2);
  mainWindow.setBounds({
    x: posX,
    y: 4,
    width: COLLAPSED_WIDTH,
    height: COLLAPSED_HEIGHT
  });
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;

  const posX = Math.round((screenWidth - COLLAPSED_WIDTH) / 2);
  const posY = 4; // Top notch border

  mainWindow = new BrowserWindow({
    width: COLLAPSED_WIDTH,
    height: COLLAPSED_HEIGHT,
    x: posX,
    y: posY,
    type: 'toolbar', // Prevents Windows "Show Desktop" (Win+D / 3-finger swipe) from minimizing it
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true, // Prevents minimizing as a standard taskbar window
    hasShadow: false,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      devTools: process.env.NODE_ENV !== 'production'
    }
  });

  // Stay on top across all virtual desktops / workspaces
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  // Prevent three-finger swipe down / Win+D ("Show Desktop") from minimizing the island
  mainWindow.on('minimize', () => {
    mainWindow?.restore();
    mainWindow?.show();
  });

  // If window receives a hide signal during Show Desktop, keep it visible
  mainWindow.on('hide', () => {
    if (!isQuitting) {
      mainWindow?.show();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M8 11.5c2.5-1 5.5-1 8 0"></path>
      <path d="M7 14.5c3-1 7-1 10 0"></path>
      <path d="M9 8.5c2-.5 4-.5 6 0"></path>
    </svg>
  `;
  const icon = nativeImage.createFromBuffer(Buffer.from(svgIcon));
  tray = new Tray(icon);
  tray.setToolTip('Spotify Dynamic Island');

  const updateContextMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isPinned ? 'Unpin Island' : 'Pin Island Open',
        type: 'checkbox',
        checked: isPinned,
        click: () => {
          isPinned = !isPinned;
          if (isPinned) {
            expandWindow();
          } else {
            collapseWindow();
          }
          mainWindow?.webContents.send('toggle-pinned', isPinned);
          updateContextMenu();
        }
      },
      {
        label: 'Toggle Demo Track',
        click: () => {
          mainWindow?.webContents.send('toggle-demo');
        }
      },
      { type: 'separator' },
      {
        label: 'Open Spotify Web',
        click: () => {
          shell.openExternal('https://open.spotify.com');
        }
      },
      {
        label: 'Reset Position',
        click: () => {
          if (mainWindow) {
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth } = primaryDisplay.bounds;
            mainWindow.setPosition(Math.round((screenWidth - COLLAPSED_WIDTH) / 2), 4);
          }
        }
      },
      {
        label: 'Quit Dynamic Island',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray?.setContextMenu(contextMenu);
  };

  updateContextMenu();
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Initialize MediaManager
  mediaManager = new MediaManager();
  mediaManager.start();

  mediaManager.on('state-changed', (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('media-state', state);
    }
  });

  // Dynamic Island Expansion / Collapse IPC
  ipcMain.on('expand-island', () => {
    expandWindow();
  });

  ipcMain.on('collapse-island', () => {
    collapseWindow();
  });

  ipcMain.handle('send-command', (_, cmd: MediaCommand) => {
    return mediaManager?.sendCommand(cmd) ?? false;
  });

  ipcMain.handle('get-initial-state', () => {
    return mediaManager?.getState();
  });

  ipcMain.on('set-pinned', (_, pinned: boolean) => {
    isPinned = pinned;
    if (pinned) {
      expandWindow();
    } else {
      collapseWindow();
    }
  });

  ipcMain.on('set-demo-mode', (_, enabled: boolean) => {
    mediaManager?.setDemoMode(enabled);
  });

  ipcMain.on('open-spotify-web', () => {
    shell.openExternal('https://open.spotify.com');
  });

  ipcMain.on('minimize-app', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('close-app', () => {
    isQuitting = true;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    mediaManager?.stop();
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  mediaManager?.stop();
});
