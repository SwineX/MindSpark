import express from 'express';
import cors from 'cors';
import { FileStore } from '../core/file-store.js';
import { createRoutes } from './routes.js';

export function createApp(store: FileStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', createRoutes(store));
  return app;
}
