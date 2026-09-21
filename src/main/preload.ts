import { contextBridge, ipcRenderer } from 'electron';
import { MediaCommand, MediaState } from '../types/media';
import { HotRect } from '../types/island';
import { IslandSettings } from '../types/settings';

const on = <T extends unknown[]>(channel: string, callback: (...args: T) => void) => {
  const handler = (_: unknown, ...args: unknown[]) => callback(...(args as T));
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

// Dynamic Island overlay bridge
contextBridge.exposeInMainWorld('dynamicIsland', {
  onMediaState: (callback: (state: MediaState) => void) =>
    on<[MediaState]>('media-state', callback),

  /** Fired by the main process while the OS cursor is over the capsule. */
  onHoverChange: (callback: (hovering: boolean) => void) =>
    on<[boolean]>('island-hover', callback),

  onTogglePinned: (callback: (pinned: boolean) => void) =>
    on<[boolean]>('toggle-pinned', callback),

  sendCommand: (cmd: MediaCommand) => ipcRenderer.invoke('send-command', cmd),
  getInitialState: (): Promise<MediaState> => ipcRenderer.invoke('get-initial-state'),

  /** Reports the capsule's target rectangle so hover hit-testing stays exact. */
  setHotRect: (rect: HotRect) => ipcRenderer.send('island-hot-rect', rect),

  /** Freezes hover tracking while a drag gesture is in progress. */
  setPointerLock: (locked: boolean) => ipcRenderer.send('island-pointer-lock', locked),

  setPinned: (pinned: boolean) => ipcRenderer.send('set-pinned', pinned),
  openSpotifyWeb: () => ipcRenderer.send('open-spotify-web'),
  minimizeApp: () => ipcRenderer.send('minimize-app'),
  closeApp: () => ipcRenderer.send('close-app'),

  // Settings integration
  getSettings: (): Promise<IslandSettings> => ipcRenderer.invoke('get-settings'),
  onSettingsChange: (callback: (settings: IslandSettings) => void) =>
    on<[IslandSettings]>('settings-changed', callback),
  openSettingsWindow: () => ipcRenderer.send('open-settings-window')
});

// Dedicated Settings Companion App bridge
contextBridge.exposeInMainWorld('niloSettings', {
  getSettings: (): Promise<IslandSettings> => ipcRenderer.invoke('get-settings'),
  updateSettings: (partial: Partial<IslandSettings>): Promise<IslandSettings> =>
    ipcRenderer.invoke('update-settings', partial),
  resetSettings: (): Promise<IslandSettings> => ipcRenderer.invoke('reset-settings'),
  onSettingsChange: (callback: (settings: IslandSettings) => void) =>
    on<[IslandSettings]>('settings-changed', callback),

  getMediaState: (): Promise<MediaState> => ipcRenderer.invoke('get-initial-state'),
  onMediaState: (callback: (state: MediaState) => void) =>
    on<[MediaState]>('media-state', callback),
  sendCommand: (cmd: MediaCommand) => ipcRenderer.invoke('send-command', cmd),

  openSpotifyWeb: () => ipcRenderer.send('open-spotify-web'),
  triggerDemo: (): Promise<boolean> => ipcRenderer.invoke('trigger-demo'),
  closeSettingsWindow: () => ipcRenderer.send('close-settings-window'),
  minimizeSettingsWindow: () => ipcRenderer.send('minimize-settings-window'),
  quitApp: () => ipcRenderer.send('close-app')
});
