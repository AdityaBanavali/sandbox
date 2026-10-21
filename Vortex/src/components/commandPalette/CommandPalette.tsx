import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Command,
  FileCode2,
  Columns2,
  Rows2,
  Terminal,
  Palette,
  Eye,
  Save,
  Plus,
  GitBranch,
} from 'lucide-react';
import type { CommandItem, FsTreeNode } from '../../types/editor';
import { TauriBridge } from '../../services/tauriBridge';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFile: (path: string, name: string) => void;
  onToggleTerminal: () => void;
  onSplitEditor: (direction: 'horizontal' | 'vertical') => void;
  onToggleTheme: () => void;
  onToggleMinimap: () => void;
  onSaveActiveFile: () => void;
  onOpenGlobalSearch: () => void;
  accentColor: string;
  initialMode?: 'files' | 'commands';
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenFile,
  onToggleTerminal,
  onSplitEditor,
  onToggleTheme,
  onToggleMinimap,
  onSaveActiveFile,
  onOpenGlobalSearch,
  accentColor,
  initialMode = 'files',
}) => {
  const [query, setQuery] = useState(initialMode === 'commands' ? '>' : '');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allFiles, setAllFiles] = useState<{ path: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load project file index on open
  useEffect(() => {
    if (isOpen) {
      setQuery(initialMode === 'commands' ? '>' : '');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      const collectFiles = async () => {
        try {
          const tree = await TauriBridge.getWorkspaceTree();
          const files: { path: string; name: string }[] = [];

          const traverse = (nodes: FsTreeNode[]) => {
            for (const n of nodes) {
              if (!n.isDir) {
                files.push({ path: n.path, name: n.name });
              } else if (n.children) {
                traverse(n.children);
              }
            }
          };

          traverse(tree);
          setAllFiles(files);
        } catch (e) {
          console.error(e);
        }
      };

      collectFiles();
    }
  }, [isOpen, initialMode]);

  const commandItems: CommandItem[] = [
    {
      id: 'cmd-terminal',
      title: 'View: Toggle Integrated Terminal',
      category: 'Terminal',
      shortcut: 'Ctrl+`',
      icon: 'terminal',
      action: () => {
        onToggleTerminal();
        onClose();
      },
    },
    {
      id: 'cmd-split-right',
      title: 'View: Split Editor Right',
      category: 'View',
      shortcut: 'Cmd+\\',
      icon: 'split-h',
      action: () => {
        onSplitEditor('horizontal');
        onClose();
      },
    },
    {
      id: 'cmd-split-down',
      title: 'View: Split Editor Down',
      category: 'View',
      icon: 'split-v',
      action: () => {
        onSplitEditor('vertical');
        onClose();
      },
    },
    {
      id: 'cmd-save',
      title: 'File: Save Current Document',
      category: 'File',
      shortcut: 'Cmd+S',
      icon: 'save',
      action: () => {
        onSaveActiveFile();
        onClose();
      },
    },
    {
      id: 'cmd-search',
      title: 'Search: Find in Workspace Files',
      category: 'Search',
      shortcut: 'Cmd+Shift+F',
      icon: 'search',
      action: () => {
        onOpenGlobalSearch();
        onClose();
      },
    },
    {
      id: 'cmd-theme',
      title: 'Preferences: Switch Color Theme',
      category: 'Preferences',
      icon: 'theme',
      action: () => {
        onToggleTheme();
        onClose();
      },
    },
    {
      id: 'cmd-minimap',
      title: 'View: Toggle Code Minimap',
      category: 'View',
      icon: 'eye',
      action: () => {
        onToggleMinimap();
        onClose();
      },
    },
  ];

  if (!isOpen) return null;

  const isCommandMode = query.startsWith('>');
  const cleanQuery = isCommandMode ? query.substring(1).trim().toLowerCase() : query.trim().toLowerCase();

  // Filter items
  const filteredCommands = commandItems.filter((c) =>
    c.title.toLowerCase().includes(cleanQuery) || c.category?.toLowerCase().includes(cleanQuery)
  );

  const filteredFiles = allFiles.filter(
    (f) => f.name.toLowerCase().includes(cleanQuery) || f.path.toLowerCase().includes(cleanQuery)
  );

  const itemsCount = isCommandMode ? filteredCommands.length : filteredFiles.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, itemsCount));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + itemsCount) % Math.max(1, itemsCount));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isCommandMode) {
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else {
        if (filteredFiles[selectedIndex]) {
          onOpenFile(filteredFiles[selectedIndex].path, filteredFiles[selectedIndex].name);
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-xs animate-in fade-in duration-100 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#121217] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100 flex flex-col max-h-[60vh]"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--vortex-card-bg, #121217)' }}
      >
        {/* Input Bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3 bg-[#15151c]">
          {isCommandMode ? (
            <Command size={18} style={{ color: accentColor }} />
          ) : (
            <Search size={18} style={{ color: accentColor }} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isCommandMode
                ? 'Type a command to execute...'
                : 'Search files by name (type > for commands)...'
            }
            className="flex-1 bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <span className="rounded bg-white/[0.08] px-2 py-0.5 text-[11px] font-mono text-zinc-400">
            Esc to close
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {isCommandMode ? (
            filteredCommands.map((cmd, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                    isSelected
                      ? 'bg-white/[0.08] font-medium text-white'
                      : 'text-zinc-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {cmd.icon === 'terminal' && <Terminal size={14} className="text-purple-400" />}
                    {cmd.icon === 'split-h' && <Columns2 size={14} className="text-purple-400" />}
                    {cmd.icon === 'split-v' && <Rows2 size={14} className="text-purple-400" />}
                    {cmd.icon === 'save' && <Save size={14} className="text-purple-400" />}
                    {cmd.icon === 'search' && <Search size={14} className="text-purple-400" />}
                    {cmd.icon === 'theme' && <Palette size={14} className="text-purple-400" />}
                    {cmd.icon === 'eye' && <Eye size={14} className="text-purple-400" />}
                    <span>{cmd.title}</span>
                  </div>

                  {cmd.shortcut && (
                    <span className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            filteredFiles.map((file, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={file.path}
                  onClick={() => {
                    onOpenFile(file.path, file.name);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                    isSelected
                      ? 'bg-white/[0.08] font-medium text-white'
                      : 'text-zinc-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileCode2 size={14} className="text-purple-400 shrink-0" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-[11px] text-zinc-500 truncate font-mono">
                      {file.path}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {itemsCount === 0 && (
            <div className="p-6 text-center text-xs text-zinc-500">
              No matching {isCommandMode ? 'commands' : 'files'} found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
