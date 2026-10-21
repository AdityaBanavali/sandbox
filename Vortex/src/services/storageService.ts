import type { EditorPaneState, SplitDirection, ThemeId } from '../types/editor';

export interface PersistedWorkspace {
  pane1: EditorPaneState;
  pane2: EditorPaneState;
  isSplit: boolean;
  splitDirection: SplitDirection;
  activePaneId: 'pane-1' | 'pane-2';
  activeSidebarTab: 'files' | 'search' | 'git' | 'chat' | 'extensions' | 'settings';
  isSidebarOpen: boolean;
  sidebarWidth: number;
  isBottomPanelOpen: boolean;
  activeBottomTab: 'terminal' | 'output' | 'ai' | 'problems';
  bottomPanelHeight: number;
  themeId: ThemeId;
  editorSettings: {
    fontSize: number;
    minimap: boolean;
    tabSize: number;
    wordWrap: 'on' | 'off';
  };
  workspaceRoot?: string;
}

const STORAGE_KEY = 'vortex_workspace_state_v1';

const DEFAULT_WORKSPACE: PersistedWorkspace = {
  pane1: {
    id: 'pane-1',
    openFiles: [
      {
        name: 'App.tsx',
        path: 'src/App.tsx',
        content: `import React from 'react';\n\n// Vortex AI-native IDE\nexport function App() {\n  return (\n    <div className="vortex-root">\n      <h1>Welcome to Vortex</h1>\n    </div>\n  );\n}\n`,
      },
    ],
    activeFileIndex: 0,
    cursorPos: { line: 1, column: 1 },
  },
  pane2: {
    id: 'pane-2',
    openFiles: [],
    activeFileIndex: 0,
    cursorPos: { line: 1, column: 1 },
  },
  isSplit: false,
  splitDirection: 'horizontal',
  activePaneId: 'pane-1',
  activeSidebarTab: 'files',
  isSidebarOpen: true,
  sidebarWidth: 260,
  isBottomPanelOpen: true,
  activeBottomTab: 'terminal',
  bottomPanelHeight: 240,
  themeId: 'vortex-dark',
  editorSettings: {
    fontSize: 13,
    minimap: true,
    tabSize: 2,
    wordWrap: 'on',
  },
  workspaceRoot: undefined,
};

export const StorageService = {
  load(): PersistedWorkspace {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return DEFAULT_WORKSPACE;
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_WORKSPACE,
        ...parsed,
        pane1: {
          ...DEFAULT_WORKSPACE.pane1,
          ...(parsed.pane1 || {}),
          openFiles: parsed.pane1?.openFiles?.length ? parsed.pane1.openFiles : DEFAULT_WORKSPACE.pane1.openFiles,
        },
        pane2: {
          ...DEFAULT_WORKSPACE.pane2,
          ...(parsed.pane2 || {}),
        },
        editorSettings: {
          ...DEFAULT_WORKSPACE.editorSettings,
          ...(parsed.editorSettings || {}),
        },
      };
    } catch (e) {
      console.warn('Failed to load persisted workspace state, using defaults:', e);
      return DEFAULT_WORKSPACE;
    }
  },

  save(state: PersistedWorkspace): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to persist workspace state:', e);
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear workspace state:', e);
    }
  },
};
