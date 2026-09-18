import { contextBridge, ipcRenderer } from 'electron';
import { MediaCommand, MediaState } from '../types/media';
import { HotRect } from '../types/island';

const on = <T extends unknown[]>(channel: string, callback: (...args: T) => void) => {
  const handler = (_: unknown, ...args: unknown[]) => callback(...(args as T));
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

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
  closeApp: () => ipcRenderer.send('close-app')
});
