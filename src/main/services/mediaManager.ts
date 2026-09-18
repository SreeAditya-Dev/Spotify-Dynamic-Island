import { EventEmitter } from 'events';
import { MediaState, MediaCommand } from '../../types/media';
import { WindowsSmtcService } from './windowsSmtc';
import { LinuxMprisService } from './linuxMpris';
import { MacMediaService } from './macMedia';
import { WebSocketBridgeService } from './webSocketBridge';

export class MediaManager extends EventEmitter {
  private windowsSmtc?: WindowsSmtcService;
  private linuxMpris?: LinuxMprisService;
  private macMedia?: MacMediaService;
  private webSocketBridge: WebSocketBridgeService;

  private currentState: MediaState = {
    id: 'idle',
    title: '',
    artist: '',
    album: '',
    artworkUrl: '',
    isPlaying: false,
    position: 0,
    duration: 0,
    source: 'system',
    timestamp: Date.now()
  };

  private demoMode = false;
  private lastBrowserState: MediaState | null = null;
  private lastOsState: MediaState | null = null;

  constructor() {
    super();
    this.webSocketBridge = new WebSocketBridgeService();

    if (process.platform === 'win32') {
      this.windowsSmtc = new WindowsSmtcService();
    } else if (process.platform === 'linux') {
      this.linuxMpris = new LinuxMprisService();
    } else if (process.platform === 'darwin') {
      this.macMedia = new MacMediaService();
    }
  }

  public start() {
    // Start WebSocket bridge for browser extensions
    this.webSocketBridge.start();
    this.webSocketBridge.on('browser-state', (state: MediaState) => {
      this.lastBrowserState = state;
      this.evaluateState();
    });
    this.webSocketBridge.on('browser-disconnected', () => {
      this.lastBrowserState = null;
      this.evaluateState();
    });

    // Start OS-specific media service
    if (this.windowsSmtc) {
      this.windowsSmtc.start();
      this.windowsSmtc.on('state', (state: MediaState) => {
        this.lastOsState = state;
        this.evaluateState();
      });
    } else if (this.linuxMpris) {
      this.linuxMpris.start();
      this.linuxMpris.on('state', (state: MediaState) => {
        this.lastOsState = state;
        this.evaluateState();
      });
    } else if (this.macMedia) {
      this.macMedia.start();
      this.macMedia.on('state', (state: MediaState) => {
        this.lastOsState = state;
        this.evaluateState();
      });
    }
  }

  private evaluateState() {
    if (this.demoMode) return;

    // Preference: If browser extension is active and playing, prioritize browser extension
    if (this.lastBrowserState && this.lastBrowserState.title && this.lastBrowserState.isPlaying) {
      this.updateState(this.lastBrowserState);
      return;
    }

    // Next: If OS media is active and playing, use OS media
    if (this.lastOsState && this.lastOsState.title && this.lastOsState.isPlaying) {
      this.updateState(this.lastOsState);
      return;
    }

    // If browser extension has a paused track
    if (this.lastBrowserState && this.lastBrowserState.title) {
      this.updateState(this.lastBrowserState);
      return;
    }

    // If OS media has a track
    if (this.lastOsState && this.lastOsState.title) {
      this.updateState(this.lastOsState);
      return;
    }

    // Default: Idle
    this.updateState({
      id: 'idle',
      title: '',
      artist: '',
      album: '',
      artworkUrl: '',
      isPlaying: false,
      position: 0,
      duration: 0,
      source: 'system',
      timestamp: Date.now()
    });
  }

  private updateState(newState: MediaState) {
    this.currentState = newState;
    this.emit('state-changed', this.currentState);
  }

  public getState(): MediaState {
    return this.currentState;
  }

  public sendCommand(cmd: MediaCommand): boolean {
    if (this.demoMode) {
      this.handleDemoCommand(cmd);
      return true;
    }

    // If current source is browser extension and extension is connected, route there
    if (this.currentState.source === 'spotify-web' && this.webSocketBridge.hasConnectedClients()) {
      const handled = this.webSocketBridge.sendCommand(cmd);
      if (handled) return true;
    }

    // Otherwise route to OS Media Session. The full command is forwarded -
    // collapsing it to cmd.type here used to drop the seek position and the
    // volume level, so those two commands silently did nothing.
    if (this.windowsSmtc) {
      return this.windowsSmtc.sendCommand(cmd);
    }

    const cmdName = typeof cmd === 'string' ? cmd : cmd.type;
    if (this.linuxMpris) {
      return this.linuxMpris.sendCommand(cmdName);
    } else if (this.macMedia) {
      return this.macMedia.sendCommand(cmdName);
    }

    return false;
  }

  public setDemoMode(enabled: boolean, mockTrack?: Partial<MediaState>) {
    this.demoMode = enabled;
    if (enabled) {
      this.updateState({
        id: 'demo-track',
        title: mockTrack?.title || 'Starboy',
        artist: mockTrack?.artist || 'The Weeknd, Daft Punk',
        album: mockTrack?.album || 'Starboy',
        artworkUrl: mockTrack?.artworkUrl || 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452',
        isPlaying: mockTrack?.isPlaying ?? true,
        position: mockTrack?.position || 45,
        duration: mockTrack?.duration || 230,
        source: 'demo',
        sourceApp: 'Spotify Demo',
        volume: 85,
        shuffle: true,
        repeat: 'off',
        timestamp: Date.now()
      });
    } else {
      this.evaluateState();
    }
  }

  private handleDemoCommand(cmd: MediaCommand) {
    if (typeof cmd === 'string') {
      if (cmd === 'toggle') {
        this.currentState.isPlaying = !this.currentState.isPlaying;
      } else if (cmd === 'play') {
        this.currentState.isPlaying = true;
      } else if (cmd === 'pause') {
        this.currentState.isPlaying = false;
      } else if (cmd === 'next') {
        this.currentState.title = 'Blinding Lights';
        this.currentState.artist = 'The Weeknd';
        this.currentState.album = 'After Hours';
        this.currentState.position = 0;
        this.currentState.duration = 200;
        this.currentState.artworkUrl = 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36';
      } else if (cmd === 'previous') {
        this.currentState.title = 'Die For You';
        this.currentState.artist = 'The Weeknd';
        this.currentState.position = 0;
        this.currentState.duration = 210;
        this.currentState.artworkUrl = 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452';
      } else if (cmd === 'toggleShuffle') {
        this.currentState.shuffle = !this.currentState.shuffle;
      } else if (cmd === 'toggleRepeat') {
        this.currentState.repeat = this.currentState.repeat === 'off' ? 'context' : 'off';
      }
    } else if (cmd.type === 'seek') {
      this.currentState.position = cmd.position;
    } else if (cmd.type === 'volume') {
      this.currentState.volume = cmd.volume;
    }
    this.currentState.timestamp = Date.now();
    this.emit('state-changed', { ...this.currentState });
  }

  public stop() {
    this.webSocketBridge.stop();
    this.windowsSmtc?.stop();
    this.linuxMpris?.stop();
    this.macMedia?.stop();
  }
}
