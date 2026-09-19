import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { MediaState, MediaCommand } from '../../types/media';

export class WebSocketBridgeService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private activeClients: Set<WebSocket> = new Set();
  private port = 9876;
  private lastBrowserState: MediaState | null = null;

  constructor() {
    super();
  }

  public start() {
    try {
      this.wss = new WebSocketServer({
        port: this.port,
        host: '127.0.0.1',
        verifyClient: (info: { origin: string; secure: boolean; req: { headers: Record<string, string | string[] | undefined> } }): boolean => {
          const originHeader = info.req.headers.origin;
          const origin = info.origin || (Array.isArray(originHeader) ? originHeader[0] : originHeader);
          if (origin === 'https://open.spotify.com') {
            return true;
          }
          // Allow connection in test / dev environment if origin header is omitted by a local process
          if (!origin && process.env.NODE_ENV !== 'production') {
            return true;
          }
          return false;
        }
      });

      this.wss.on('connection', (ws) => {
        this.activeClients.add(ws);
        this.emit('client-connected', this.activeClients.size);

        ws.on('message', (data: Buffer | string) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'spotify-state' && message.data && typeof message.data === 'object') {
              const raw = message.data;

              // Validate artwork URL protocol: only allow https:// and data:image/
              let safeArtworkUrl = '';
              if (typeof raw.artworkUrl === 'string') {
                const trimmed = raw.artworkUrl.trim();
                if (trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
                  safeArtworkUrl = trimmed;
                }
              }

              const state: MediaState = {
                id: String(raw.id || `${raw.title || ''}-${raw.artist || ''}`).slice(0, 200),
                title: String(raw.title || 'Unknown Title').slice(0, 300),
                artist: String(raw.artist || 'Unknown Artist').slice(0, 300),
                album: String(raw.album || '').slice(0, 300),
                artworkUrl: safeArtworkUrl,
                isPlaying: Boolean(raw.isPlaying),
                position: Math.max(0, Number(raw.position) || 0),
                duration: Math.max(0, Number(raw.duration) || 0),
                source: 'spotify-web',
                sourceApp: String(raw.browser || 'Spotify Web').slice(0, 100),
                volume: typeof raw.volume === 'number' ? Math.min(100, Math.max(0, raw.volume)) : 100,
                isMuted: Boolean(raw.isMuted),
                shuffle: Boolean(raw.shuffle),
                repeat: raw.repeat === 'track' || raw.repeat === 'context' ? raw.repeat : 'off',
                timestamp: Date.now()
              };

              this.lastBrowserState = state;
              this.emit('browser-state', state);
            }
          } catch {}
        });

        ws.on('close', () => {
          this.activeClients.delete(ws);
          this.emit('client-disconnected', this.activeClients.size);
          if (this.activeClients.size === 0) {
            this.lastBrowserState = null;
            this.emit('browser-disconnected');
          }
        });

        ws.on('error', () => {
          this.activeClients.delete(ws);
        });
      });

      this.wss.on('error', (err) => {
        console.error('WebSocketBridge error:', err.message);
      });
    } catch (e: any) {
      console.error('Failed to start WebSocketBridge on port', this.port, e?.message);
    }
  }

  public hasConnectedClients(): boolean {
    return this.activeClients.size > 0;
  }

  public sendCommand(cmd: MediaCommand): boolean {
    if (this.activeClients.size === 0) return false;

    const payload = JSON.stringify({
      type: 'command',
      command: cmd
    });

    let sent = false;
    for (const ws of this.activeClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sent = true;
      }
    }
    return sent;
  }

  public stop() {
    if (this.wss) {
      for (const client of this.activeClients) {
        try { client.close(); } catch {}
      }
      this.activeClients.clear();
      this.wss.close();
      this.wss = null;
    }
  }
}
