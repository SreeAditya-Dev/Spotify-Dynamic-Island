export type MediaSource = 
  | 'spotify-desktop'
  | 'spotify-web'
  | 'browser'
  | 'system'
  | 'demo';

export interface MediaState {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  isPlaying: boolean;
  position: number; // in seconds
  duration: number; // in seconds
  source: MediaSource;
  sourceApp?: string;
  volume?: number; // 0 to 100
  isMuted?: boolean;
  shuffle?: boolean;
  repeat?: 'off' | 'track' | 'context';
  timestamp: number; // Date.now() when state was captured
}

export type MediaCommand =
  | 'play'
  | 'pause'
  | 'toggle'
  | 'next'
  | 'previous'
  | { type: 'seek'; position: number }
  | { type: 'volume'; volume: number }
  | 'toggleShuffle'
  | 'toggleRepeat';

export interface IslandSettings {
  alwaysOnTop: boolean;
  pinned: boolean; // keep expanded without hovering
  topMargin: number; // distance from top of screen in px
  scale: number; // 0.9 to 1.2
  soundwaveEffect: boolean;
  dynamicGlow: boolean;
  closeToTray: boolean;
  demoMode: boolean;
}
