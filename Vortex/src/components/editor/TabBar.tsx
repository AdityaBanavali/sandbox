import React, { useState } from 'react';
import {
  FileCode2,
  X,
  Circle,
  Columns2,
  Rows2,
  XSquare,
  FileText,
  FileJson,
  FileCode,
} from 'lucide-react';
import type { OpenFile, SplitDirection } from '../../types/editor';

interface TabBarProps {
  files: OpenFile[];
  activeFileIndex: number;
  onSelectTab: (index: number) => void;
  onCloseTab: (index: number) => void;
  onCloseOthers: (index: number) => void;
  onCloseAll: () => void;
  isSplit: boolean;
  splitDirection: SplitDirection;
  onSplit: (direction: SplitDirection) => void;
  onClosePane?: () => void;
  paneId: 'pane-1' | 'pane-2';
  accentColor: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  files,
  activeFileIndex,
  onSelectTab,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  isSplit,
  splitDirection,
  onSplit,
  onClosePane,
  accentColor,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabIndex: number;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabIndex: index });
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return <FileCode2 size={13} className="text-cyan-400" />;
      case 'js':
      case 'jsx':
        return <FileCode2 size={13} className="text-yellow-400" />;
      case 'rs':
        return <FileCode size={13} className="text-orange-400" />;
      case 'json':
        return <FileJson size={13} className="text-emerald-400" />;
      case 'css':
      case 'scss':
        return <FileCode2 size={13} className="text-sky-400" />;
      case 'md':
        return <FileText size={13} className="text-purple-400" />;
      default:
        return <FileCode2 size={13} className="text-zinc-500" />;
    }
  };

  return (
    <div
      className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c0c10] px-1 select-none"
      onClick={() => setContextMenu(null)}
      style={{ backgroundColor: 'var(--vortex-tabbar-bg, #0c0c10)' }}
    >
      {/* Scrollable Tabs */}
      <div className="flex h-full items-center gap-1 overflow-x-auto scrollbar-none">
        {files.map((file, idx) => {
          const isActive = activeFileIndex === idx;
          return (
            <div
              key={`${file.path}-${idx}`}
              onClick={() => onSelectTab(idx)}
              onMouseDown={(e) => {
                // Middle click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  onCloseTab(idx);
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, idx)}
              className={`group relative flex h-[34px] shrink-0 cursor-pointer items-center gap-2 rounded-t-md px-3 text-[12.5px] transition-all border-b-2 ${
                isActive
                  ? 'bg-white/[0.07] font-medium text-white border-purple-500'
                  : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200 border-transparent'
              }`}
              style={{
                borderBottomColor: isActive ? accentColor : 'transparent',
              }}
            >
              {getFileIcon(file.name)}
              <span className="max-w-[150px] truncate">{file.name}</span>

              {/* Dirty indicator or close button */}
              <div className="flex items-center ml-1">
                {file.dirty ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(idx);
                    }}
                    className="flex h-4 w-4 items-center justify-center rounded hover:bg-white/10"
                  >
                    <Circle size={7} className="fill-amber-400 text-amber-400 group-hover:hidden" />
                    <X size={12} className="hidden group-hover:block text-zinc-400 hover:text-white" />
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(idx);
                    }}
                    className="flex h-4 w-4 items-center justify-center rounded p-0.5 text-zinc-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {files.length === 0 && (
          <div className="px-3 text-[12px] italic text-zinc-600">No open editors</div>
        )}
      </div>

      {/* Split pane action controls */}
      <div className="flex shrink-0 items-center gap-1 pr-1.5">
        <button
          onClick={() => onSplit('horizontal')}
          title="Split Editor Right (Side-by-side)"
          className="rounded p-1 text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 transition-colors"
        >
          <Columns2 size={14} />
        </button>
        <button
          onClick={() => onSplit('vertical')}
          title="Split Editor Down"
          className="rounded p-1 text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 transition-colors"
        >
          <Rows2 size={14} />
        </button>
        {isSplit && onClosePane && (
          <button
            onClick={onClosePane}
            title="Close Split Pane"
            className="rounded p-1 text-zinc-500 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          >
            <XSquare size={14} />
          </button>
        )}
      </div>

      {/* Right click tab context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-44 rounded-lg border border-white/[0.1] bg-[#141419] p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y + 4, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onCloseTab(contextMenu.tabIndex);
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2.5 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            Close Tab
          </button>
          <button
            onClick={() => {
              onCloseOthers(contextMenu.tabIndex);
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2.5 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            Close Other Tabs
          </button>
          <button
            onClick={() => {
              onCloseAll();
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          >
            Close All Tabs
          </button>
        </div>
      )}
    </div>
  );
};
