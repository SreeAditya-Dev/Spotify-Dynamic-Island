import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { MediaManager } from './services/mediaManager';
import { MediaCommand } from '../types/media';
import {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  STAGE_TOP,
  HOVER_PADDING,
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
// An always-on-top overlay gets marked "occluded" whenever a fullscreen app
// (game, video) is in front of it. Chromium then stops painting, so the island
// would freeze mid-morph and come back showing a stale frame.
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let mainWindow: BrowserWindow | null = null;
let mediaManager: MediaManager | null = null;
let tray: Tray | null = null;
let isPinned = false;
let isQuitting = false;

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
let hotRect: HotRect = capsuleRect('compact');
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

    const nextHovering = pointerIsOverCapsule();
    if (nextHovering === isHovering) return;

    isHovering = nextHovering;
    setInteractive(nextHovering);
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
 * Windows lets any app claim the topmost band, so a video player or game that
 * goes fullscreen *after* us pushes the island underneath and it never comes
 * back. Re-assert our place periodically and whenever focus moves elsewhere.
 */
const KEEP_ON_TOP_MS = 1200;
let keepOnTopTimer: NodeJS.Timeout | null = null;

function assertOnTop() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    // 'screen-saver' is the highest level Electron exposes; re-applying it
    // re-issues the native topmost flag that another app may have taken.
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Raises the window without activating it, so focus is never stolen.
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

function centerStage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { width: screenWidth } = screen.getPrimaryDisplay().bounds;
  mainWindow.setBounds({
    x: Math.round((screenWidth - STAGE_WIDTH) / 2),
    y: STAGE_TOP,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT
  });
}

function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().bounds;

  mainWindow = new BrowserWindow({
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    x: Math.round((screenWidth - STAGE_WIDTH) / 2),
    y: STAGE_TOP,
    type: 'toolbar', // Prevents Windows "Show Desktop" (Win+D / 3-finger swipe) from minimizing it
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // Required on Windows, else the stage paints an opaque box
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true, // Prevents minimizing as a standard taskbar window
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

  // The stage is click-through until the cursor actually reaches the capsule.
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

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

  mainWindow.webContents.on('did-finish-load', () => {
    startHoverTracking();
    startKeepOnTop();
  });

  // Another window taking focus is the usual moment we get demoted.
  mainWindow.on('blur', () => assertOnTop());
  mainWindow.on('show', () => assertOnTop());
  mainWindow.on('restore', () => assertOnTop());

  mainWindow.on('closed', () => {
    stopHoverTracking();
    stopKeepOnTop();
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
      {
        label: 'Reset Position',
        click: () => centerStage()
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

  // The renderer owns the capsule geometry and reports its target rectangle
  // whenever the capsule changes shape, so hit-testing follows the animation.
  ipcMain.on('island-hot-rect', (_, rect: HotRect) => {
    if (!rect || typeof rect.width !== 'number' || typeof rect.height !== 'number') return;
    hotRect = rect;
  });

  // Freeze hover tracking for the duration of a drag gesture.
  ipcMain.on('island-pointer-lock', (_, locked: boolean) => {
    pointerLocked = Boolean(locked);
    if (pointerLockTimer) {
      clearTimeout(pointerLockTimer);
      pointerLockTimer = null;
    }
    // Safety net in case a pointerup never reaches the renderer.
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

  // Keep the stage centred if the display layout changes
  screen.on('display-metrics-changed', () => centerStage());
  screen.on('display-added', () => centerStage());
  screen.on('display-removed', () => centerStage());
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
