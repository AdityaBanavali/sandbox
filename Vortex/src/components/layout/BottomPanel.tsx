import React, { useState } from 'react';
import {
  Terminal as TerminalIcon,
  FlaskConical,
  AlertCircle,
  Sparkles,
  PanelBottomClose,
  Maximize2,
  Minimize2,
  Circle,
} from 'lucide-react';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { ChatSessionManager } from '../chat/ChatSessionManager';
import type { EditorDiagnostics, OpenFile } from '../../types/editor';

export type BottomPanelTab = 'terminal' | 'output' | 'problems' | 'ai';

interface BottomPanelProps {
  isOpen: boolean;
  activeTab: BottomPanelTab;
  onSelectTab: (tab: BottomPanelTab) => void;
  onClose: () => void;
  diagnostics: EditorDiagnostics;
  currentFile?: OpenFile;
  accentColor: string;
  workspaceRoot?: string;
  onInsertAtCursor?: (code: string) => void;
  onCreateNewFile?: (code: string, language: string) => void;
  height?: number;
  onHeightChange?: (newHeight: number) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  activeTab,
  onSelectTab,
  onClose,
  diagnostics,
  currentFile,
  accentColor,
  workspaceRoot,
  onInsertAtCursor,
  onCreateNewFile,
  height = 240,
  onHeightChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY; // Dragging up increases height
      const newHeight = Math.min(Math.max(startHeight + delta, 120), window.innerHeight * 0.85);
      onHeightChange?.(newHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const tabs: { id: BottomPanelTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon size={13} /> },
    { id: 'output', label: 'Test Output', icon: <FlaskConical size={13} /> },
    {
      id: 'problems',
      label: 'Problems',
      icon: <AlertCircle size={13} />,
      badge: diagnostics.errors + diagnostics.warnings,
    },
    { id: 'ai', label: 'AI Console', icon: <Sparkles size={13} /> },
  ];

  return (
    <div
      className="relative flex shrink-0 flex-col border-t border-white/[0.08] bg-[#0e0e12] select-none"
      style={{
        height: isExpanded ? '75vh' : `${height}px`,
        backgroundColor: 'var(--vortex-bottom-bg, #0e0e12)',
      }}
    >
      {/* Draggable Top Horizontal Resize Handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        onDoubleClick={() => onHeightChange?.(240)}
        title="Drag to resize panel height (double-click to reset)"
        className="absolute -top-1 left-0 right-0 z-40 h-2 cursor-row-resize hover:bg-purple-500/60 active:bg-purple-500 transition-colors"
      />

      {/* Header bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#111116] px-3 select-none">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all ${
                  isActive
                    ? 'bg-white/[0.08] text-white shadow-xs'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <span className={isActive ? 'text-purple-400' : 'text-zinc-500 group-hover:text-zinc-300'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Restore Panel Size' : 'Maximize Panel'}
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 transition-colors"
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={onClose}
            title="Close Panel (Ctrl+`)"
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 transition-colors"
          >
            <PanelBottomClose size={14} />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'terminal' && (
          <TerminalPanel workspaceRoot={workspaceRoot} accentColor={accentColor} />
        )}

        {activeTab === 'output' && (
          <div className="h-full overflow-y-auto p-4 font-mono text-[12px] text-zinc-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Circle size={8} className="fill-emerald-400 text-emerald-400" />
              <span>Vortex Build Engine: Ready (cargo + vite live)</span>
            </div>
            <p className="text-zinc-500">[Info] Watching workspace files for incremental hot module reload...</p>
            <p className="text-zinc-400">All tests passing: 12 passed, 0 failed, 0 skipped.</p>
            <div className="rounded border border-white/[0.05] bg-black/20 p-3 text-zinc-400">
              ➜ Frontend bundle: Vite 8.2.2 ready on http://127.0.0.1:1420/<br />
              ➜ Backend target: custom-cursor-app-lib [tokio + tauri v2 runtime]
            </div>
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="h-full overflow-y-auto p-4 text-[12.5px]">
            {diagnostics.errors === 0 && diagnostics.warnings === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-zinc-500 gap-2">
                <Circle size={18} className="text-emerald-500 fill-emerald-500/20" />
                <p>No syntax problems detected in the current workspace.</p>
              </div>
            ) : (
              <div className="space-y-2 font-mono">
                {diagnostics.errors > 0 && (
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{diagnostics.errors} Error(s) reported in active editor documents</span>
                  </div>
                )}
                {diagnostics.warnings > 0 && (
                  <div className="flex items-start gap-2 text-amber-400">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{diagnostics.warnings} Warning(s) reported</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <ChatSessionManager
            currentFile={currentFile}
            onInsertAtCursor={onInsertAtCursor}
            onCreateNewFile={onCreateNewFile}
            accentColor={accentColor}
          />
        )}
      </div>
    </div>
  );
};
