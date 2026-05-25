import { config } from './config.js';
import { FileStore } from './core/file-store.js';
import { createApp } from './api/server.js';
import { startMCPServer } from './mcp/server.js';

async function main() {
  const store = new FileStore(config.workspaceDir);

  // Start HTTP + WebSocket server
  const { server } = createApp(store);
  server.listen(config.port, () => {
    console.log(`Mindspark API server: http://localhost:${config.port}`);
    console.log(`WebSocket: ws://localhost:${config.port}/ws`);
    console.log(`Workspace: ${config.workspaceDir}`);
  });

  // Start MCP stdio server (blocks on stdio)
  await startMCPServer(store);
}

main().catch(console.error);
