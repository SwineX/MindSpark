import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

export interface WSEvent {
  type: 'node_updated' | 'node_added' | 'node_deleted' | 'node_moved' | 'file_created' | 'file_deleted';
  file: string;
  path?: string;
  [key: string]: unknown;
}

export class WSManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
    });
  }

  broadcast(event: WSEvent): void {
    const data = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
