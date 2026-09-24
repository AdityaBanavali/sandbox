import type { Monaco } from '@monaco-editor/react';
import type { ThemeConfig, ThemeId } from '../types/editor';

export const THEMES: Record<ThemeId, ThemeConfig> = {
  'vortex-dark': {
    id: 'vortex-dark',
    name: 'Vortex Dark (Deep Purple)',
    monacoTheme: 'vortex-dark-theme',
    isDark: true,
    accent: '#8b7cf6',
  },
  'vscode-dark': {
    id: 'vscode-dark',
    name: 'VS Code Dark Modern',
    monacoTheme: 'vs-dark',
    isDark: true,
    accent: '#3b82f6',
  },
  'midnight-obsidian': {
    id: 'midnight-obsidian',
    name: 'Midnight Obsidian (OLED)',
    monacoTheme: 'midnight-obsidian-theme',
    isDark: true,
    accent: '#06b6d4',
  },
  'vortex-light': {
    id: 'vortex-light',
    name: 'Vortex Light Modern',
    monacoTheme: 'vs',
    isDark: false,
    accent: '#6366f1',
  },
};

export function registerMonacoThemes(monaco: Monaco) {
  // Vortex Dark: Deep rich charcoal with purple/cyan syntax
  monaco.editor.defineTheme('vortex-dark-theme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '636e7b', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c084fc', fontStyle: 'bold' },
      { token: 'string', foreground: '34d399' },
      { token: 'number', foreground: 'f59e0b' },
      { token: 'type', foreground: '38bdf8' },
      { token: 'identifier', foreground: 'e4e4e7' },
      { token: 'function', foreground: '818cf8' },
      { token: 'delimiter', foreground: '94a3b8' },
    ],
    colors: {
      'editor.background': '#0e0e12',
      'editor.foreground': '#e4e4e7',
      'editorCursor.foreground': '#a78bfa',
      'editor.lineHighlightBackground': '#181822',
      'editorLineNumber.foreground': '#474758',
      'editorLineNumber.activeForeground': '#c4b5fd',
      'editor.selectionBackground': '#3730a355',
      'editor.inactiveSelectionBackground': '#2e287a33',
      'editorIndentGuide.background': '#1e1e2d',
      'editorIndentGuide.activeBackground': '#3f3f5a',
      'editorOverviewRuler.border': '#181822',
    },
  });

  // Midnight Obsidian: Pure OLED black with vibrant neon tokens
  monaco.editor.defineTheme('midnight-obsidian-theme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '4b5563', fontStyle: 'italic' },
      { token: 'keyword', foreground: '22d3ee', fontStyle: 'bold' },
      { token: 'string', foreground: 'a3e635' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: '67e8f9' },
      { token: 'function', foreground: '38bdf8' },
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#f3f4f6',
      'editorCursor.foreground': '#22d3ee',
      'editor.lineHighlightBackground': '#09090b',
      'editorLineNumber.foreground': '#3f3f46',
      'editorLineNumber.activeForeground': '#22d3ee',
      'editor.selectionBackground': '#0e749044',
      'editorIndentGuide.background': '#18181b',
      'editorIndentGuide.activeBackground': '#27272a',
    },
  });
}
