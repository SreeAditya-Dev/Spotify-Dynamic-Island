import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { MediaState } from '../../types/media';

export class LinuxMprisService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private isAvailable = false;

  constructor() {
    super();
  }

  public start() {
    if (process.platform !== 'linux') return;
    
    // Check if playerctl is installed
    exec('which playerctl', (err) => {
      if (!err) {
        this.isAvailable = true;
        this.poll();
        this.timer = setInterval(() => this.poll(), 1200);
      }
    });
  }

  private poll() {
    if (!this.isAvailable) return;
    const format = `{"title":"{{title}}","artist":"{{artist}}","album":"{{album}}","status":"{{status}}","position":{{position}},"duration":{{mpris:length}},"artUrl":"{{mpris:artUrl}}","player":"{{playerName}}"}`;
    exec(`playerctl metadata --format '${format}'`, (err, stdout) => {
      if (err || !stdout.trim()) {
        this.emit('state', {
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
        } as MediaState);
        return;
      }

      try {
        const data = JSON.parse(stdout.trim());
        const isPlaying = (data.status || '').toLowerCase() === 'playing';
        const positionSec = Math.round((Number(data.position) || 0) / 1000000);
        const durationSec = Math.round((Number(data.duration) || 0) / 1000000);
        const isSpotify = (data.player || '').toLowerCase().includes('spotify');

        const state: MediaState = {
          id: `${data.title}-${data.artist}`,
          title: data.title || 'Unknown Title',
          artist: data.artist || 'Unknown Artist',
          album: data.album || '',
          artworkUrl: data.artUrl || '',
          isPlaying,
          position: positionSec,
          duration: durationSec,
          source: isSpotify ? 'spotify-desktop' : 'browser',
          sourceApp: data.player || 'Linux Player',
          timestamp: Date.now()
        };
        this.emit('state', state);
      } catch {}
    });
  }

  public sendCommand(cmd: string): boolean {
    if (!this.isAvailable) return false;
    let playerctlCmd = '';
    switch (cmd.toLowerCase()) {
      case 'play': playerctlCmd = 'playerctl play'; break;
      case 'pause': playerctlCmd = 'playerctl pause'; break;
      case 'toggle': playerctlCmd = 'playerctl play-pause'; break;
      case 'next': playerctlCmd = 'playerctl next'; break;
      case 'previous':
      case 'prev': playerctlCmd = 'playerctl previous'; break;
      default: return false;
    }
    exec(playerctlCmd, () => {});
    return true;
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
