export interface OpenFile {
  name: string;
  path: string;
  content: string;
  language?: string;
  dirty?: boolean;
}

export interface FsTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FsTreeNode[];
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface EditorPaneState {
  id: 'pane-1' | 'pane-2';
  openFiles: OpenFile[];
  activeFileIndex: number;
  cursorPos: { line: number; column: number };
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface EditorDiagnostics {
  errors: number;
  warnings: number;
  infos: number;
}

export type ThemeId = 'vortex-dark' | 'vscode-dark' | 'midnight-obsidian' | 'vortex-light';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  monacoTheme: string;
  isDark: boolean;
  accent: string;
}

export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchFileResult {
  path: string;
  fileName: string;
  matches: SearchMatch[];
}

export interface CommandItem {
  id: string;
  title: string;
  category?: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
}

export interface GitStatus {
  branch: string;
  isClean: boolean;
  changedFiles: string[];
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface TerminalLine {
  id: string;
  type: 'command' | 'stdout' | 'stderr' | 'system';
  content: string;
  timestamp: string;
}
