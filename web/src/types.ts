export interface MindmapNode {
  title: string;
  depth: number;
  path: string;
  meta: Record<string, unknown>;
  body: string;
  children: MindmapNode[];
}

export interface WSEvent {
  type: 'node_updated' | 'node_added' | 'node_deleted' | 'node_moved' | 'file_created' | 'file_deleted';
  file: string;
  path?: string;
  [key: string]: unknown;
}
