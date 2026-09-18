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
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('connection', (ws) => {
        this.activeClients.add(ws);
        this.emit('client-connected', this.activeClients.size);

        ws.on('message', (data: Buffer | string) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'spotify-state') {
              const state: MediaState = {
                id: message.data.id || `${message.data.title}-${message.data.artist}`,
                title: message.data.title || 'Unknown Title',
                artist: message.data.artist || 'Unknown Artist',
                album: message.data.album || '',
                artworkUrl: message.data.artworkUrl || '',
                isPlaying: Boolean(message.data.isPlaying),
                position: Number(message.data.position) || 0,
                duration: Number(message.data.duration) || 0,
                source: 'spotify-web',
                sourceApp: message.data.browser || 'Spotify Web',
                volume: typeof message.data.volume === 'number' ? message.data.volume : 100,
                isMuted: Boolean(message.data.isMuted),
                shuffle: Boolean(message.data.shuffle),
                repeat: message.data.repeat || 'off',
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
