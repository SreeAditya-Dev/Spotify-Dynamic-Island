import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, NativeImage, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MediaManager } from './services/mediaManager';
import { SettingsManager } from './services/settingsManager';
import { MediaCommand } from '../types/media';
import { IslandSettings } from '../types/settings';
import {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  STAGE_TOP,
  HOVER_PADDING,
  STAGE_INNER_PADDING,
  HotRect,
  capsuleRect
} from '../types/island';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance optimizations for ultra-low RAM and butter-smooth 120fps rendering
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const settingsManager = new SettingsManager(undefined, app);

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let mediaManager: MediaManager | null = null;
let tray: Tray | null = null;
let isPinned = false;
let isQuitting = false;

// Single-instance handling: opening companion app or running second instance focuses Settings
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    createSettingsWindow();
  });
}

/**
 * Hover tracking.
 *
 * The window itself is a fixed, click-through stage - it never resizes, so the
 * capsule can be animated with plain CSS at full frame rate. Because the stage
 * covers a large transparent area, we hit-test the OS cursor against the
 * capsule's current rectangle ourselves and flip the window to interactive only
 * while the cursor is actually over the capsule.
 */
const HOVER_POLL_MS = 24;
let hotRect: HotRect = capsuleRect('compact', settingsManager.getSettings().position);
let isHovering = false;
let hoverTimer: NodeJS.Timeout | null = null;
let isInteractive = false;

/**
 * Held while a pointer button is down inside the capsule. Dragging the seek or
 * volume slider can stray past the capsule edge, and making the window
 * click-through mid-drag would drop the gesture.
 */
let pointerLocked = false;
let pointerLockTimer: NodeJS.Timeout | null = null;
const POINTER_LOCK_TIMEOUT_MS = 15000;

function setInteractive(interactive: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (interactive === isInteractive) return;
  isInteractive = interactive;
  // forward: true keeps mouse-move messages flowing to the renderer while the
  // window is click-through, so CSS :hover inside the capsule stays alive.
  mainWindow.setIgnoreMouseEvents(!interactive, { forward: true });
}

function pointerIsOverCapsule(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  const cursor = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();

  const left = bounds.x + hotRect.x - HOVER_PADDING;
  const top = bounds.y + hotRect.y - HOVER_PADDING;
  const right = left + hotRect.width + HOVER_PADDING * 2;
  const bottom = top + hotRect.height + HOVER_PADDING * 2;

  return cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom;
}

function startHoverTracking() {
  if (hoverTimer) clearInterval(hoverTimer);
  hoverTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (pointerLocked) return;

    const overCapsule = pointerIsOverCapsule();
    const settings = settingsManager.getSettings();

    // The stage becomes interactive whenever cursor is over capsule so clicks register
    setInteractive(overCapsule);

    // Only fire hover expansion if hoverEnabled is turned on!
    const nextHovering = overCapsule && settings.hoverEnabled;
    if (nextHovering === isHovering) return;

    isHovering = nextHovering;
    mainWindow.webContents.send('island-hover', nextHovering);
  }, HOVER_POLL_MS);
}

function stopHoverTracking() {
  if (hoverTimer) {
    clearInterval(hoverTimer);
    hoverTimer = null;
  }
}

/**
 * Re-assert topmost band periodically and on focus blur.
 */
const KEEP_ON_TOP_MS = 1200;
let keepOnTopTimer: NodeJS.Timeout | null = null;

function assertOnTop() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.moveTop();
  } catch {}
}

function startKeepOnTop() {
  if (keepOnTopTimer) clearInterval(keepOnTopTimer);
  keepOnTopTimer = setInterval(assertOnTop, KEEP_ON_TOP_MS);
}

function stopKeepOnTop() {
  if (keepOnTopTimer) {
    clearInterval(keepOnTopTimer);
    keepOnTopTimer = null;
  }
}

/** Calculates stage window bounds based on screen dimensions (always centered) */
function getStageBounds(_settings?: IslandSettings) {
  const display = screen.getPrimaryDisplay();
  const screenWidth = display.bounds.width;
  const screenX = display.bounds.x;
  const screenY = display.bounds.y;
  const x = screenX + Math.round((screenWidth - STAGE_WIDTH) / 2);
  const y = screenY + STAGE_TOP;
  return { x, y, width: STAGE_WIDTH, height: STAGE_HEIGHT };
}

function updateStageBounds(settings?: IslandSettings) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = getStageBounds(settings);
  mainWindow.setBounds(bounds);
}

function getAppIcon(): NativeImage | null {
  const possiblePaths = [
    path.join(__dirname, '../../dist/logo.png'),
    path.join(__dirname, '../../public/logo.png'),
    path.join(process.cwd(), 'public/logo.png'),
    path.join(process.cwd(), 'spotify_dynamic_island.png')
  ];
  const iconPath = possiblePaths.find((p) => fs.existsSync(p));
  if (iconPath) {
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) return img;
    } catch {}
  }
  return null;
}

function createWindow() {
  const appIcon = getAppIcon();
  const bounds = getStageBounds();

  mainWindow = new BrowserWindow({
    title: 'Nilo',
    icon: appIcon || undefined,
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    type: 'toolbar', // Prevents Windows "Show Desktop" (Win+D) from minimizing it
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      devTools: process.env.NODE_ENV !== 'production'
    }
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  mainWindow.on('minimize', () => {
    mainWindow?.restore();
    mainWindow?.show();
  });

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

  mainWindow.webContents.on('did-finish-load', () => {
    startHoverTracking();
    startKeepOnTop();
  });

  mainWindow.on('blur', () => assertOnTop());
  mainWindow.on('show', () => assertOnTop());
  mainWindow.on('restore', () => assertOnTop());

  mainWindow.on('closed', () => {
    stopHoverTracking();
    stopKeepOnTop();
    mainWindow = null;
  });
}

/** Opens or focuses the separate Settings Companion App window */
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const appIcon = getAppIcon();

  settingsWindow = new BrowserWindow({
    title: 'Nilo Preferences',
    icon: appIcon || undefined,
    width: 860,
    height: 660,
    minWidth: 720,
    minHeight: 540,
    backgroundColor: '#0d0e12',
    autoHideMenuBar: true,
    show: false,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      devTools: process.env.NODE_ENV !== 'production'
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#settings`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../../dist/index.html'), { hash: 'settings' });
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
    settingsWindow?.focus();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray() {
  const appIcon = getAppIcon();
  let icon: NativeImage;
  if (appIcon && !appIcon.isEmpty()) {
    icon = appIcon.resize({ width: 16, height: 16 });
  } else {
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M8 11.5c2.5-1 5.5-1 8 0"></path>
        <path d="M7 14.5c3-1 7-1 10 0"></path>
        <path d="M9 8.5c2-.5 4-.5 6 0"></path>
      </svg>
    `;
    icon = nativeImage.createFromBuffer(Buffer.from(svgIcon));
  }
  tray = new Tray(icon);
  tray.setToolTip('Nilo - Spotify Dynamic Island');

  const updateContextMenu = () => {
    const currentSettings = settingsManager.getSettings();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Preferences...',
        click: () => createSettingsWindow()
      },
      { type: 'separator' },
      {
        label: 'Expand on Hover',
        type: 'checkbox',
        checked: currentSettings.hoverEnabled,
        click: (menuItem) => {
          settingsManager.updateSettings({ hoverEnabled: menuItem.checked });
        }
      },
      {
        label: isPinned ? 'Unpin Island' : 'Pin Island Open',
        type: 'checkbox',
        checked: isPinned,
        click: () => {
          isPinned = !isPinned;
          mainWindow?.webContents.send('toggle-pinned', isPinned);
          updateContextMenu();
        }
      },
      { type: 'separator' },
      {
        label: 'Open Spotify Web',
        click: () => {
          shell.openExternal('https://open.spotify.com');
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Nilo',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray?.setContextMenu(contextMenu);
  };

  updateContextMenu();

  tray.on('double-click', () => {
    createSettingsWindow();
  });

  // Re-build tray menu whenever settings change
  settingsManager.on('settings-changed', () => {
    updateContextMenu();
  });
}

app.whenReady().then(() => {
  app.setName('Nilo');
  createWindow();
  createTray();

  // If launched with --settings argument, open Settings app directly
  if (process.argv.includes('--settings')) {
    createSettingsWindow();
  }

  // Initialize MediaManager
  mediaManager = new MediaManager();
  mediaManager.start();

  mediaManager.on('state-changed', (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('media-state', state);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('media-state', state);
    }
  });

  // Settings listener: update stage position and broadcast to renderers
  settingsManager.on('settings-changed', (updatedSettings) => {
    updateStageBounds(updatedSettings);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-changed', updatedSettings);
      if (!updatedSettings.hoverEnabled && isHovering) {
        isHovering = false;
        mainWindow.webContents.send('island-hover', false);
      }
    }

    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('settings-changed', updatedSettings);
    }
  });

  // IPC Settings Handlers
  ipcMain.handle('get-settings', () => {
    return settingsManager.getSettings();
  });

  ipcMain.handle('update-settings', (_, partial: Partial<IslandSettings>) => {
    return settingsManager.updateSettings(partial);
  });

  ipcMain.handle('reset-settings', () => {
    return settingsManager.resetSettings();
  });

  ipcMain.on('open-settings-window', () => {
    createSettingsWindow();
  });

  ipcMain.on('close-settings-window', () => {
    settingsWindow?.close();
  });

  ipcMain.on('minimize-settings-window', () => {
    settingsWindow?.minimize();
  });

  ipcMain.handle('trigger-demo', () => {
    if (!mediaManager) return false;
    mediaManager.setDemoMode(true);
    setTimeout(() => {
      mediaManager?.setDemoMode(false);
    }, 10000);
    return true;
  });

  // Geometry and interaction hit-testing
  ipcMain.on('island-hot-rect', (_, rect: HotRect) => {
    if (!rect || typeof rect.width !== 'number' || typeof rect.height !== 'number') return;
    hotRect = rect;
  });

  ipcMain.on('island-pointer-lock', (_, locked: boolean) => {
    pointerLocked = Boolean(locked);
    if (pointerLockTimer) {
      clearTimeout(pointerLockTimer);
      pointerLockTimer = null;
    }
    if (pointerLocked) {
      pointerLockTimer = setTimeout(() => {
        pointerLocked = false;
        pointerLockTimer = null;
      }, POINTER_LOCK_TIMEOUT_MS);
    }
  });

  ipcMain.handle('send-command', (_, cmd: MediaCommand) => {
    return mediaManager?.sendCommand(cmd) ?? false;
  });

  ipcMain.handle('get-initial-state', () => {
    return mediaManager?.getState();
  });

  ipcMain.on('set-pinned', (_, pinned: boolean) => {
    isPinned = pinned;
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

  // Keep the stage positioned properly if the display layout changes
  screen.on('display-metrics-changed', () => updateStageBounds());
  screen.on('display-added', () => updateStageBounds());
  screen.on('display-removed', () => updateStageBounds());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopHoverTracking();
    stopKeepOnTop();
    mediaManager?.stop();
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopHoverTracking();
  stopKeepOnTop();
  mediaManager?.stop();
});
