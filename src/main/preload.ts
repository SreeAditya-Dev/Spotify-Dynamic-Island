import { contextBridge, ipcRenderer } from 'electron';
import { MediaCommand, MediaState } from '../types/media';

contextBridge.exposeInMainWorld('dynamicIsland', {
  onMediaState: (callback: (state: MediaState) => void) => {
    const handler = (_: any, state: MediaState) => callback(state);
    ipcRenderer.on('media-state', handler);
    return () => ipcRenderer.removeListener('media-state', handler);
  },
  sendCommand: (cmd: MediaCommand) => ipcRenderer.invoke('send-command', cmd),
  getInitialState: (): Promise<MediaState> => ipcRenderer.invoke('get-initial-state'),
  setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => 
    ipcRenderer.send('set-ignore-mouse-events', ignore, { forward }),
  resizeWindow: (width: number, height: number) =>
    ipcRenderer.send('resize-window', width, height),
  setPinned: (pinned: boolean) => ipcRenderer.send('set-pinned', pinned),
  setDemoMode: (enabled: boolean) => ipcRenderer.send('set-demo-mode', enabled),
  openSpotifyWeb: () => ipcRenderer.send('open-spotify-web'),
  minimizeApp: () => ipcRenderer.send('minimize-app'),
  closeApp: () => ipcRenderer.send('close-app')
});
