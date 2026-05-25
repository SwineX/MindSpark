import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export class FileStore {
  constructor(private workspaceDir: string) {}

  async listFiles(): Promise<string[]> {
    const entries = await fs.readdir(this.workspaceDir, { recursive: true });
    return entries
      .filter((e) => typeof e === 'string' && e.endsWith('.md'))
      .map((e) => e.replace(/\\/g, '/'))
      .sort();
  }

  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.workspaceDir, relativePath);
    if (!fullPath.startsWith(this.workspaceDir)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    return fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.workspaceDir, relativePath);
    if (!fullPath.startsWith(this.workspaceDir)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Atomic write: write to temp file, then rename
    const tmpPath = path.join(tmpdir(), `mindspark-${randomUUID()}.tmp`);
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, fullPath);
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.workspaceDir, relativePath);
    if (!fullPath.startsWith(this.workspaceDir)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    await fs.unlink(fullPath);
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.workspaceDir, relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
