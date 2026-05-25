import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface TmpWorkspace {
  dir: string;
  writeMd: (name: string, content: string) => Promise<string>;
  cleanup: () => Promise<void>;
}

export async function createTmpWorkspace(): Promise<TmpWorkspace> {
  const dir = path.join(os.tmpdir(), `mindspark-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(dir, { recursive: true });

  const workspace: TmpWorkspace = {
    dir,
    writeMd: async (name: string, content: string) => {
      const filePath = path.join(dir, name);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return filePath;
    },
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };

  return workspace;
}
