import React from 'react';
import type { ActivityTab } from './ActivityBar';
import { FileTree } from '../explorer/FileTree';
import { GlobalSearch } from '../search/GlobalSearch';
import { SourceControl } from '../git/SourceControl';
import { SettingsView } from '../settings/SettingsView';
import { ChatSessionManager } from '../chat/ChatSessionManager';
import type { OpenFile, ThemeId } from '../../types/editor';
import { Blocks } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  activeTab: ActivityTab;
  onClose: () => void;
  onOpenFile: (path: string, name?: string) => void;
  activeFilePath?: string;
  onNavigateToMatch: (path: string, line: number) => void;
  currentThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  minimapEnabled: boolean;
  onToggleMinimap: () => void;
  tabSize: number;
  onChangeTabSize: (size: number) => void;
  wordWrap: 'on' | 'off';
  onToggleWordWrap: () => void;
  accentColor: string;
  currentFile?: OpenFile;
  onInsertAtCursor?: (code: string) => void;
  onCreateNewFile?: (code: string, language: string) => void;
  width?: number;
  onWidthChange?: (newWidth: number) => void;
  onOpenBranchManager?: () => void;
  onOpenCommitHistory?: () => void;
  onGitStatusUpdated?: (status: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeTab,
  onClose,
  onOpenFile,
  activeFilePath,
  onNavigateToMatch,
  currentThemeId,
  onSelectTheme,
  fontSize,
  onChangeFontSize,
  minimapEnabled,
  onToggleMinimap,
  tabSize,
  onChangeTabSize,
  wordWrap,
  onToggleWordWrap,
  accentColor,
  currentFile,
  onInsertAtCursor,
  onCreateNewFile,
  width = 260,
  onWidthChange,
  onOpenBranchManager = () => {},
  onOpenCommitHistory = () => {},
  onGitStatusUpdated,
}) => {
  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 180), 700);
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="relative flex shrink-0 flex-col border-r border-white/[0.06] bg-[#101014] select-none group/sidebar"
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--vortex-sidebar-bg, #101014)',
      }}
    >
      {/* Dynamic Tool Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <FileTree
            onOpenFile={onOpenFile}
            activeFilePath={activeFilePath}
            accentColor={accentColor}
          />
        )}

        {activeTab === 'search' && (
          <GlobalSearch
            onNavigateToMatch={onNavigateToMatch}
            accentColor={accentColor}
          />
        )}

        {activeTab === 'git' && (
          <SourceControl
            onOpenFile={onOpenFile}
            accentColor={accentColor}
            onOpenBranchManager={onOpenBranchManager}
            onOpenCommitHistory={onOpenCommitHistory}
            onStatusUpdated={onGitStatusUpdated}
          />
        )}

        {activeTab === 'chat' && (
          <ChatSessionManager
            currentFile={currentFile}
            onInsertAtCursor={onInsertAtCursor}
            onCreateNewFile={onCreateNewFile}
            accentColor={accentColor}
          />
        )}

        {activeTab === 'extensions' && (
          <div className="flex h-full flex-col p-4 text-xs text-zinc-400 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-zinc-200">
              <Blocks size={16} style={{ color: accentColor }} />
              <span>Installed Extensions</span>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Monaco Core Language Server', version: 'v4.7.0', active: true },
                { name: 'Rust Analyzer Integration', version: 'v0.1.0', active: true },
                { name: 'Tailwind CSS Engine v4', version: 'v4.3.3', active: true },
                { name: 'Tauri Native Shell Bridge', version: 'v2.11', active: true },
              ].map((ext) => (
                <div
                  key={ext.name}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-zinc-200">{ext.name}</div>
                    <div className="text-[10px] text-zinc-500">{ext.version}</div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsView
            currentThemeId={currentThemeId}
            onSelectTheme={onSelectTheme}
            fontSize={fontSize}
            onChangeFontSize={onChangeFontSize}
            minimapEnabled={minimapEnabled}
            onToggleMinimap={onToggleMinimap}
            tabSize={tabSize}
            onChangeTabSize={onChangeTabSize}
            wordWrap={wordWrap}
            onToggleWordWrap={onToggleWordWrap}
            accentColor={accentColor}
          />
        )}
      </div>

      {/* Draggable Vertical Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onWidthChange?.(260)}
        title="Drag to resize sidebar (double-click to reset to default)"
        className="absolute -right-1 top-0 bottom-0 z-40 w-2 cursor-col-resize hover:bg-purple-500/60 active:bg-purple-500 transition-colors"
      />
    </div>
  );
};
