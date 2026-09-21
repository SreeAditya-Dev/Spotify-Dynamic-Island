import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { MediaState, MediaCommand } from '../../types/media';
import { resolveArtwork } from './artworkResolver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SMTC reports an app user model id like
 * "Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic" or "chrome.exe".
 * Turn that into something worth showing in the island.
 */
const APP_NAMES: [RegExp, string][] = [
  [/spotify/i, 'Spotify'],
  [/chrome/i, 'Chrome'],
  [/msedge|microsoft\.?edge/i, 'Edge'],
  [/brave/i, 'Brave'],
  [/firefox/i, 'Firefox'],
  [/opera/i, 'Opera'],
  [/vivaldi/i, 'Vivaldi'],
  [/zunemusic|windowsmediaplayer|media\.?player/i, 'Media Player'],
  [/vlc/i, 'VLC'],
  [/itunes|apple.*music/i, 'Apple Music']
];

export function friendlyAppName(appId: string): string {
  if (!appId) return 'Media Player';
  for (const [pattern, name] of APP_NAMES) {
    if (pattern.test(appId)) return name;
  }
  // Fall back to the executable / package stem, e.g. "foobar2000.exe" -> "foobar2000"
  const stem = appId.split('!').pop()!.split('.').filter(Boolean)[0] || appId;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

export class WindowsSmtcService extends EventEmitter {
  private psProcess: ChildProcess | null = null;
  private isAlive = false;
  private lastState: MediaState | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private artworkKey = '';
  private artworkUrl = '';

  constructor() {
    super();
  }

  public start() {
    if (process.platform !== 'win32') return;
    this.spawnDaemon();
  }

  private getScriptPath(): string {
    const isAsar = __dirname.includes('app.asar');

    // 1. Direct on-disk candidates outside of app.asar
    const directCandidates = [
      // If packaged with asarUnpack, it lives in app.asar.unpacked
      path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'windows-smtc-daemon.ps1'),
      // If copied via extraResources
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'windows-smtc-daemon.ps1') : '',
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'app.asar.unpacked', 'dist-electron', 'main', 'windows-smtc-daemon.ps1') : '',
      // Development mode paths
      !isAsar ? path.join(__dirname, 'windows-smtc-daemon.ps1') : '',
      path.join(process.cwd(), 'src', 'main', 'services', 'windows-smtc-daemon.ps1'),
      path.join(process.cwd(), 'dist-electron', 'main', 'windows-smtc-daemon.ps1'),
    ].filter(Boolean);

    for (const p of directCandidates) {
      try {
        if (!p.includes('app.asar') && fs.existsSync(p)) {
          return p;
        }
      } catch {}
    }

    // 2. If it only exists inside an .asar archive, extract it to disk so powershell.exe can execute it
    const asarCandidates = [
      path.join(__dirname, 'windows-smtc-daemon.ps1'),
      path.join(__dirname, '..', '..', 'src', 'main', 'services', 'windows-smtc-daemon.ps1'),
    ];

    for (const p of asarCandidates) {
      try {
        if (fs.existsSync(p)) {
          let targetDir = '';
          try {
            const electron = require('electron');
            if (electron.app && typeof electron.app.getPath === 'function') {
              targetDir = electron.app.getPath('userData');
            }
          } catch {}
          if (!targetDir) {
            targetDir = path.join(os.tmpdir(), 'nilo');
          }
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          const targetFile = path.join(targetDir, 'windows-smtc-daemon.ps1');
          const scriptContent = fs.readFileSync(p, 'utf8');
          if (!fs.existsSync(targetFile) || fs.readFileSync(targetFile, 'utf8') !== scriptContent) {
            fs.writeFileSync(targetFile, scriptContent, 'utf8');
          }
          return targetFile;
        }
      } catch (err) {
        console.error('[WindowsSmtc] Failed extracting script from asar:', err);
      }
    }

    return path.join(process.cwd(), 'src', 'main', 'services', 'windows-smtc-daemon.ps1');
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

      this.psProcess.stderr?.on('data', (chunk: Buffer) => {
        console.error('[WindowsSmtc Daemon Stderr]:', chunk.toString('utf8'));
      });

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
                const trackKey = `${rawData.title}:::${rawData.artist}`;

                // Resolve artwork only when the track actually changes. The
                // daemon polls once a second, so resolving every tick meant a
                // 2.5s network round-trip per poll and states piling up behind
                // it - the island would lag seconds behind the real track.
                if (trackKey !== this.artworkKey) {
                  this.artworkKey = trackKey;
                  this.artworkUrl = await resolveArtwork(
                    rawData.title,
                    rawData.artist,
                    rawData.artworkUrl
                  );
                } else if (rawData.artworkUrl && !this.artworkUrl) {
                  this.artworkUrl = rawData.artworkUrl;
                }

                const appId: string = rawData.sourceApp || '';
                const isSpotify = appId.toLowerCase().includes('spotify') ||
                                  (rawData.title && rawData.title.toLowerCase().includes('spotify'));

                const state: MediaState = {
                  id: `${rawData.title}-${rawData.artist}`,
                  title: rawData.title || 'Unknown Title',
                  artist: rawData.artist || 'Unknown Artist',
                  album: rawData.album || '',
                  artworkUrl: this.artworkUrl || rawData.artworkUrl || '',
                  isPlaying: Boolean(rawData.isPlaying),
                  position: Number(rawData.position) || 0,
                  duration: Number(rawData.duration) || 0,
                  source: isSpotify ? 'spotify-desktop' : 'browser',
                  sourceApp: friendlyAppName(appId),
                  canSeek: Boolean(rawData.canSeek),
                  volume:
                    typeof rawData.volume === 'number' && rawData.volume >= 0
                      ? rawData.volume
                      : undefined,
                  isMuted: Boolean(rawData.isMuted),
                  shuffle: Boolean(rawData.shuffle),
                  repeat:
                    rawData.repeat === 'track' || rawData.repeat === 'context'
                      ? rawData.repeat
                      : 'off',
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

      this.psProcess.on('exit', (code) => {
        console.warn(`[WindowsSmtc] Daemon process exited with code ${code}`);
        this.isAlive = false;
        this.scheduleRestart();
      });

      this.psProcess.on('error', (err) => {
        console.error('[WindowsSmtc] Daemon process error:', err);
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

  /**
   * Commands that carry a value are serialised as "name:value" - the daemon
   * splits on the first colon. Seek is sent in seconds, volume as 0-100.
   */
  private static serialize(cmd: MediaCommand): string {
    if (typeof cmd === 'string') return cmd.toLowerCase();
    if (cmd.type === 'seek') return `seek:${Math.max(0, Math.round(cmd.position * 10) / 10)}`;
    if (cmd.type === 'volume') return `volume:${Math.round(Math.min(100, Math.max(0, cmd.volume)))}`;
    return String((cmd as { type: string }).type).toLowerCase();
  }

  public sendCommand(cmd: MediaCommand): boolean {
    if (!this.isAlive || !this.psProcess || !this.psProcess.stdin) return false;
    try {
      this.psProcess.stdin.write(`CMD:${WindowsSmtcService.serialize(cmd)}\n`);
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
