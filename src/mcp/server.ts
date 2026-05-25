import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FileStore } from '../core/file-store.js';
import { createToolHandlers } from './tools.js';

export async function startMCPServer(store: FileStore): Promise<void> {
  const handlers = createToolHandlers(store);

  const server = new Server(
    { name: 'mindspark', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'list_mindmaps', description: 'List all .md mindmap files in the workspace', inputSchema: { type: 'object', properties: {} } },
      { name: 'read_mindmap', description: 'Read a mindmap as flat indented snapshot text', inputSchema: { type: 'object', properties: { file: { type: 'string' }, path: { type: 'string' }, depth: { type: 'number' }, include_meta: { type: 'boolean' }, include_body: { type: 'boolean' }, follow_links: { type: 'boolean' } }, required: ['file'] } },
      { name: 'add_node', description: 'Add a child heading under a parent node', inputSchema: { type: 'object', properties: { file: { type: 'string' }, parent_path: { type: 'string' }, title: { type: 'string' }, meta: { type: 'object' }, body: { type: 'string' } }, required: ['file', 'parent_path', 'title'] } },
      { name: 'update_node', description: 'Update a node title or merge its metadata', inputSchema: { type: 'object', properties: { file: { type: 'string' }, path: { type: 'string' }, title: { type: 'string' }, meta: { type: 'object' }, body: { type: 'string' } }, required: ['file', 'path'] } },
      { name: 'delete_node', description: 'Delete a node and its subtree', inputSchema: { type: 'object', properties: { file: { type: 'string' }, path: { type: 'string' } }, required: ['file', 'path'] } },
      { name: 'move_node', description: 'Move a subtree to a new parent', inputSchema: { type: 'object', properties: { file: { type: 'string' }, path: { type: 'string' }, new_parent_path: { type: 'string' }, position: { type: 'number' } }, required: ['file', 'path', 'new_parent_path'] } },
      { name: 'preview', description: 'Generate an interactive HTML preview of a mindmap', inputSchema: { type: 'object', properties: { file: { type: 'string' }, open: { type: 'boolean' } }, required: ['file'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = (handlers as Record<string, Function>)[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);

    const result = await handler(args ?? {});
    return { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
