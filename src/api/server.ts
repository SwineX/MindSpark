import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { FileStore } from '../core/file-store.js';
import { createRoutes } from './routes.js';
import { WSManager } from './ws.js';

export function createApp(store: FileStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const wsManager = new WSManager();
  app.use('/api', createRoutes(store, wsManager));

  const server = http.createServer(app);
  wsManager.attach(server);

  return { app, server, wsManager };
}
