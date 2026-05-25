import { create } from 'zustand';
import type { MindmapNode } from './types.js';

interface MindsparkState {
  file: string;
  files: string[];
  mdContent: string;
  selectedPath: string | null;
  selectedNode: MindmapNode | null;
  tree: MindmapNode | null;
  connected: boolean;

  setFile: (file: string) => void;
  setFiles: (files: string[]) => void;
  setMdContent: (content: string) => void;
  setTree: (tree: MindmapNode | null) => void;
  selectNode: (path: string | null, node: MindmapNode | null) => void;
  setConnected: (connected: boolean) => void;
}

export const useMindsparkStore = create<MindsparkState>((set) => ({
  file: 'sample-project.md',
  files: [],
  mdContent: '',
  selectedPath: null,
  selectedNode: null,
  tree: null,
  connected: false,

  setFile: (file) => set({ file, selectedPath: null, selectedNode: null }),
  setFiles: (files) => set({ files }),
  setMdContent: (mdContent) => set({ mdContent }),
  setTree: (tree) => set({ tree }),
  selectNode: (path, node) => set({ selectedPath: path, selectedNode: node }),
  setConnected: (connected) => set({ connected }),
}));
