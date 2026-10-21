import React, { forwardRef } from 'react';
import { TabBar } from './TabBar';
import { Breadcrumbs } from './Breadcrumbs';
import { MonacoEditorWrapper, type MonacoEditorHandle } from './MonacoEditorWrapper';
import type { CursorPosition, EditorDiagnostics, OpenFile, SplitDirection, ThemeConfig } from '../../types/editor';
import { getLanguageFromPath } from '../../services/languageService';
import { FileCode, Command, Sparkles } from 'lucide-react';

interface EditorPaneProps {
  paneId: 'pane-1' | 'pane-2';
  isActive: boolean;
  onFocus: () => void;
  files: OpenFile[];
  activeFileIndex: number;
  onSelectTab: (index: number) => void;
  onCloseTab: (index: number) => void;
  onCloseOthers: (index: number) => void;
  onCloseAll: () => void;
  onFileContentChange: (newContent: string) => void;
  onCursorChange: (pos: CursorPosition) => void;
  onDiagnosticsChange: (diag: EditorDiagnostics) => void;
  onSaveFile: () => void;
  isSplit: boolean;
  splitDirection: SplitDirection;
  onSplit: (direction: SplitDirection) => void;
  onClosePane?: () => void;
  themeConfig: ThemeConfig;
  fontSize?: number;
  minimapEnabled?: boolean;
  tabSize?: number;
  wordWrap?: 'on' | 'off';
  onOpenCommandPalette?: () => void;
}

export const EditorPane = forwardRef<MonacoEditorHandle, EditorPaneProps>(
  (
    {
      paneId,
      isActive,
      onFocus,
      files,
      activeFileIndex,
      onSelectTab,
      onCloseTab,
      onCloseOthers,
      onCloseAll,
      onFileContentChange,
      onCursorChange,
      onDiagnosticsChange,
      onSaveFile,
      isSplit,
      splitDirection,
      onSplit,
      onClosePane,
      themeConfig,
      fontSize,
      minimapEnabled,
      tabSize,
      wordWrap,
      onOpenCommandPalette,
    },
    ref
  ) => {
    const activeFile = files[activeFileIndex];
    const language = activeFile
      ? activeFile.language || getLanguageFromPath(activeFile.path)
      : 'plaintext';

    return (
      <div
        onClick={onFocus}
        className={`relative flex h-full flex-1 flex-col overflow-hidden transition-all ${
          isActive ? 'ring-1 ring-purple-500/30' : 'opacity-95'
        }`}
        style={{ backgroundColor: 'var(--vortex-editor-bg, #0e0e12)' }}
      >
        {/* Tabs bar */}
        <TabBar
          files={files}
          activeFileIndex={activeFileIndex}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onCloseOthers={onCloseOthers}
          onCloseAll={onCloseAll}
          isSplit={isSplit}
          splitDirection={splitDirection}
          onSplit={onSplit}
          onClosePane={onClosePane}
          paneId={paneId}
          accentColor={themeConfig.accent}
        />

        {/* Breadcrumb path tracker */}
        {activeFile && (
          <Breadcrumbs filePath={activeFile.path} accentColor={themeConfig.accent} />
        )}

        {/* Editor canvas or Empty State */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {activeFile ? (
            <MonacoEditorWrapper
              ref={ref}
              key={`${activeFile.path}-${paneId}`}
              value={activeFile.content}
              language={language}
              themeConfig={themeConfig}
              fontSize={fontSize}
              minimapEnabled={minimapEnabled}
              tabSize={tabSize}
              wordWrap={wordWrap}
              onChange={(val) => onFileContentChange(val ?? '')}
              onCursorChange={onCursorChange}
              onDiagnosticsChange={onDiagnosticsChange}
              onSave={onSaveFile}
              focusOnMount={isActive}
              filePath={activeFile.path}
              accentColor={themeConfig.accent}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center select-none bg-[#09090c]">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-950/20 border border-purple-500/20 mb-4 shadow-xl">
                <Sparkles size={28} style={{ color: themeConfig.accent }} />
              </div>
              <h3 className="text-base font-semibold text-zinc-300 mb-1">Vortex Code Editor</h3>
              <p className="text-xs text-zinc-400 max-w-sm mb-6">
                AI-native desktop development environment. No active file in this pane.
              </p>

              <div className="flex flex-col gap-2 text-xs text-zinc-400">
                <button
                  onClick={onOpenCommandPalette}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 hover:bg-white/[0.08] hover:text-white transition-all shadow-sm"
                >
                  <Command size={13} style={{ color: themeConfig.accent }} />
                  <span>Quick Open File</span>
                  <span className="ml-4 rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                    Cmd / Ctrl + P
                  </span>
                </button>

                <button
                  onClick={onOpenCommandPalette}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 hover:bg-white/[0.08] hover:text-white transition-all shadow-sm"
                >
                  <FileCode size={13} style={{ color: themeConfig.accent }} />
                  <span>Show All Commands</span>
                  <span className="ml-4 rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                    Cmd / Ctrl + Shift + P
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

EditorPane.displayName = 'EditorPane';
