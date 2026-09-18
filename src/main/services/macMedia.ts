import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { MediaState } from '../../types/media';

export class MacMediaService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  public start() {
    if (process.platform !== 'darwin') return;
    this.poll();
    this.timer = setInterval(() => this.poll(), 1200);
  }

  private poll() {
    // AppleScript querying Spotify desktop
    const script = `
      if application "Spotify" is running then
        tell application "Spotify"
          set tTitle to name of current track
          set tArtist to artist of current track
          set tAlbum to album of current track
          set tArt to artwork url of current track
          set tDuration to (duration of current track) / 1000
          set tPos to player position
          set tState to player state as string
          return tTitle & ":::" & tArtist & ":::" & tAlbum & ":::" & tArt & ":::" & tDuration & ":::" & tPos & ":::" & tState
        end tell
      else
        return "idle"
      end if
    `;

    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout) => {
      if (err || !stdout.trim() || stdout.trim() === 'idle') {
        return;
      }

      const parts = stdout.trim().split(':::');
      if (parts.length >= 7) {
        const [title, artist, album, art, durStr, posStr, stateStr] = parts;
        const state: MediaState = {
          id: `${title}-${artist}`,
          title,
          artist,
          album,
          artworkUrl: art || '',
          isPlaying: stateStr.toLowerCase() === 'playing',
          position: Math.round(Number(posStr) || 0),
          duration: Math.round(Number(durStr) || 0),
          source: 'spotify-desktop',
          sourceApp: 'Spotify Mac',
          timestamp: Date.now()
        };
        this.emit('state', state);
      }
    });
  }

  public sendCommand(cmd: string): boolean {
    let script = '';
    switch (cmd.toLowerCase()) {
      case 'play': script = 'tell application "Spotify" to play'; break;
      case 'pause': script = 'tell application "Spotify" to pause'; break;
      case 'toggle': script = 'tell application "Spotify" to playpause'; break;
      case 'next': script = 'tell application "Spotify" to next track'; break;
      case 'previous':
      case 'prev': script = 'tell application "Spotify" to previous track'; break;
      default: return false;
    }
    exec(`osascript -e '${script}'`, () => {});
    return true;
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
