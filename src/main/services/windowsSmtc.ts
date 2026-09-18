import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { MediaState } from '../../types/media';
import { resolveArtwork } from './artworkResolver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WindowsSmtcService extends EventEmitter {
  private psProcess: ChildProcess | null = null;
  private isAlive = false;
  private lastState: MediaState | null = null;
  private restartTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  public start() {
    if (process.platform !== 'win32') return;
    this.spawnDaemon();
  }

  private getScriptPath(): string {
    // Check both src location and dist-electron location
    const candidates = [
      path.join(__dirname, 'windows-smtc-daemon.ps1'),
      path.join(process.cwd(), 'src', 'main', 'services', 'windows-smtc-daemon.ps1'),
      path.join(__dirname, '..', '..', 'src', 'main', 'services', 'windows-smtc-daemon.ps1'),
    ];

    for (const p of candidates) {
      try {
        if (require('fs').existsSync(p)) return p;
      } catch {}
    }
    return candidates[1];
  }

  private spawnDaemon() {
    try {
      const scriptPath = this.getScriptPath();
      this.psProcess = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      this.isAlive = true;
      let buffer = '';

      this.psProcess.stdout?.on('data', async (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith('STATE:')) {
            const jsonStr = line.substring(6);
            try {
              const rawData = JSON.parse(jsonStr);
              if (rawData.title || rawData.artist) {
                // If artworkUrl is empty or not high-res, resolve
                const art = await resolveArtwork(rawData.title, rawData.artist, rawData.artworkUrl);
                
                const isSpotify = (rawData.sourceApp && rawData.sourceApp.toLowerCase().includes('spotify')) ||
                                  (rawData.title && rawData.title.toLowerCase().includes('spotify'));

                const state: MediaState = {
                  id: `${rawData.title}-${rawData.artist}`,
                  title: rawData.title || 'Unknown Title',
                  artist: rawData.artist || 'Unknown Artist',
                  album: rawData.album || '',
                  artworkUrl: art || rawData.artworkUrl || '',
                  isPlaying: Boolean(rawData.isPlaying),
                  position: Number(rawData.position) || 0,
                  duration: Number(rawData.duration) || 0,
                  source: isSpotify ? 'spotify-desktop' : 'browser',
                  sourceApp: rawData.sourceApp || 'Media Player',
                  timestamp: rawData.timestamp || Date.now()
                };

                this.lastState = state;
                this.emit('state', state);
              } else {
                // Idle / No media playing
                const idleState: MediaState = {
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
                this.lastState = idleState;
                this.emit('state', idleState);
              }
            } catch {}
          }
        }
      });

      this.psProcess.on('exit', () => {
        this.isAlive = false;
        this.scheduleRestart();
      });

      this.psProcess.on('error', () => {
        this.isAlive = false;
        this.scheduleRestart();
      });
    } catch {
      this.scheduleRestart();
    }
  }

  private scheduleRestart() {
    if (this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.isAlive) {
        this.spawnDaemon();
      }
    }, 4000);
  }

  public sendCommand(cmd: string): boolean {
    if (!this.isAlive || !this.psProcess || !this.psProcess.stdin) return false;
    try {
      this.psProcess.stdin.write(`CMD:${cmd}\n`);
      return true;
    } catch {
      return false;
    }
  }

  public stop() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.psProcess) {
      try {
        this.psProcess.stdin?.write('EXIT\n');
        this.psProcess.kill();
      } catch {}
      this.psProcess = null;
    }
    this.isAlive = false;
  }
}
