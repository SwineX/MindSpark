import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

export const config = {
  port: 16393,
  workspaceDir: path.join(PROJECT_ROOT, 'workspace'),
  projectRoot: PROJECT_ROOT,
};
