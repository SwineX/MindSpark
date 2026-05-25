import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class FileStore {
  private workspaceDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = path.resolve(workspaceDir);
  }

  /** Resolves relativePath against workspaceDir; throws on path traversal. */
  private resolvePath(relativePath: string): string {
    const fullPath = path.join(this.workspaceDir, relativePath);
    const prefix = this.workspaceDir.endsWith(path.sep)
      ? this.workspaceDir
      : this.workspaceDir + path.sep;
    if (!fullPath.startsWith(prefix) && fullPath !== this.workspaceDir) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    return fullPath;
  }

  async listFiles(): Promise<string[]> {
    const entries = await fs.readdir(this.workspaceDir, { recursive: true });
    return entries
      .filter((e) => typeof e === 'string' && e.endsWith('.md'))
      .map((e) => e.replace(/\\/g, '/'))
      .sort();
  }

  async readFile(relativePath: string): Promise<string> {
    const fullPath = this.resolvePath(relativePath);
    return fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Atomic write: write to a temp file in the same directory, then rename
    const tmpPath = path.join(
      path.dirname(fullPath),
      `.mindspark-${randomUUID()}.tmp`,
    );
    await fs.writeFile(tmpPath, content, 'utf-8');
    await fs.rename(tmpPath, fullPath);
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await fs.unlink(fullPath);
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
