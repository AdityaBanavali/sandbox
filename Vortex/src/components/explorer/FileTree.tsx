import React, { useState, useEffect } from 'react';
import {
  FolderClosed,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  RotateCw,
  Trash2,
  Edit2,
  FileCode2,
  FileJson,
  FileText,
  FileCode,
  FolderTree,
} from 'lucide-react';
import type { FsTreeNode } from '../../types/editor';
import { TauriBridge } from '../../services/tauriBridge';

interface FileTreeProps {
  onOpenFile: (path: string, name: string) => void;
  activeFilePath?: string;
  accentColor: string;
}

export const FileTree: React.FC<FileTreeProps> = ({ onOpenFile, activeFilePath, accentColor }) => {
  const [treeData, setTreeData] = useState<FsTreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['src', 'crates']));
  const [isLoading, setIsLoading] = useState(false);

  // New file / folder inline inputs
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [targetParentPath, setTargetParentPath] = useState<string>('');
  const [newEntryName, setNewEntryName] = useState('');

  // Rename inline state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FsTreeNode;
  } | null>(null);

  const loadTree = async () => {
    setIsLoading(true);
    try {
      const data = await TauriBridge.getWorkspaceTree();
      setTreeData(data);
    } catch (err) {
      console.error('Failed to load project tree:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleCollapseAll = () => {
    setExpandedPaths(new Set());
  };

  const handleCreateEntry = async () => {
    if (!newEntryName.trim() || !creatingType) {
      setCreatingType(null);
      setNewEntryName('');
      return;
    }

    const fullPath = targetParentPath
      ? `${targetParentPath}/${newEntryName.trim()}`
      : newEntryName.trim();

    if (creatingType === 'file') {
      await TauriBridge.createFile(fullPath);
      onOpenFile(fullPath, newEntryName.trim());
    } else {
      await TauriBridge.createDirectory(fullPath);
      setExpandedPaths((prev) => new Set([...prev, fullPath]));
    }

    setCreatingType(null);
    setNewEntryName('');
    await loadTree();
  };

  const handleDeleteEntry = async (path: string) => {
    if (window.confirm(`Are you sure you want to delete '${path}'?`)) {
      await TauriBridge.deleteEntry(path);
      await loadTree();
    }
  };

  const handleRenameSubmit = async () => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }

    const parts = renamingPath.split('/');
    parts.pop();
    const newPath = parts.length > 0 ? `${parts.join('/')}/${renameValue.trim()}` : renameValue.trim();

    await TauriBridge.renameEntry(renamingPath, newPath);
    setRenamingPath(null);
    setRenameValue('');
    await loadTree();
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return <FileCode2 size={13} className="text-cyan-400 shrink-0" />;
      case 'js':
      case 'jsx':
        return <FileCode2 size={13} className="text-yellow-400 shrink-0" />;
      case 'rs':
        return <FileCode size={13} className="text-orange-400 shrink-0" />;
      case 'json':
        return <FileJson size={13} className="text-emerald-400 shrink-0" />;
      case 'css':
      case 'scss':
        return <FileCode2 size={13} className="text-sky-400 shrink-0" />;
      case 'md':
        return <FileText size={13} className="text-purple-400 shrink-0" />;
      default:
        return <FileCode2 size={13} className="text-zinc-500 shrink-0" />;
    }
  };

  const renderNodes = (nodes: FsTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedPaths.has(node.path);
      const isSelected = activeFilePath === node.path;
      const isRenamingThis = renamingPath === node.path;

      if (node.isDir) {
        return (
          <div key={node.path} className="flex flex-col">
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, node });
              }}
              onClick={() => toggleExpand(node.path)}
              className="group flex w-full cursor-pointer items-center justify-between rounded-md py-1 pr-2 text-left text-[12.5px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {isExpanded ? (
                  <ChevronDown size={12} className="shrink-0 text-zinc-500" />
                ) : (
                  <ChevronRight size={12} className="shrink-0 text-zinc-500" />
                )}
                {isExpanded ? (
                  <FolderOpen size={14} className="shrink-0 text-purple-400" />
                ) : (
                  <FolderClosed size={14} className="shrink-0 text-zinc-500" />
                )}
                {isRenamingThis ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') setRenamingPath(null);
                    }}
                    onBlur={handleRenameSubmit}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    className="h-5 rounded border border-purple-500 bg-black/60 px-1 text-[12px] text-zinc-100 outline-none"
                  />
                ) : (
                  <span className="truncate font-medium">{node.name}</span>
                )}
              </div>

              {/* Hover actions */}
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingType('file');
                    setTargetParentPath(node.path);
                    setExpandedPaths((prev) => new Set([...prev, node.path]));
                  }}
                  title="New File in folder"
                  className="rounded p-0.5 text-zinc-500 hover:text-white"
                >
                  <FilePlus size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingType('folder');
                    setTargetParentPath(node.path);
                    setExpandedPaths((prev) => new Set([...prev, node.path]));
                  }}
                  title="New Folder in folder"
                  className="rounded p-0.5 text-zinc-500 hover:text-white"
                >
                  <FolderPlus size={12} />
                </button>
              </div>
            </div>

            {/* Inline creation inside this folder */}
            {creatingType && targetParentPath === node.path && (
              <div
                className="flex items-center gap-1.5 py-1"
                style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
              >
                {creatingType === 'file' ? (
                  <FileCode2 size={13} className="text-purple-400 shrink-0" />
                ) : (
                  <FolderClosed size={13} className="text-purple-400 shrink-0" />
                )}
                <input
                  type="text"
                  placeholder={creatingType === 'file' ? 'filename.ts' : 'folder-name'}
                  value={newEntryName}
                  onChange={(e) => setNewEntryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateEntry();
                    if (e.key === 'Escape') setCreatingType(null);
                  }}
                  onBlur={handleCreateEntry}
                  autoFocus
                  className="h-5 flex-1 rounded border border-purple-500 bg-black/80 px-1 text-[12px] text-white outline-none"
                />
              </div>
            )}

            {isExpanded && node.children && (
              <div className="flex flex-col">{renderNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      // File node
      return (
        <div
          key={node.path}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, node });
          }}
          onClick={() => onOpenFile(node.path, node.name)}
          className={`group flex w-full cursor-pointer items-center justify-between rounded-md py-1 pr-2 text-left text-[12.5px] transition-colors ${
            isSelected
              ? 'bg-white/[0.08] font-medium text-white'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
          style={{ paddingLeft: `${depth * 12 + 18}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {getFileIcon(node.name)}
            {isRenamingThis ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenamingPath(null);
                }}
                onBlur={handleRenameSubmit}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className="h-5 rounded border border-purple-500 bg-black/60 px-1 text-[12px] text-zinc-100 outline-none"
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteEntry(node.path);
            }}
            title="Delete file"
            className="hidden group-hover:block rounded p-0.5 text-zinc-600 hover:text-red-400"
          >
            <Trash2 size={11} />
          </button>
        </div>
      );
    });
  };

  return (
    <div
      className="flex h-full flex-col select-none text-zinc-300"
      onClick={() => setContextMenu(null)}
    >
      {/* Explorer header with action icons */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          Workspace Files
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setCreatingType('file');
              setTargetParentPath('');
            }}
            title="New File at root"
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors"
          >
            <FilePlus size={13} />
          </button>
          <button
            onClick={() => {
              setCreatingType('folder');
              setTargetParentPath('');
            }}
            title="New Folder at root"
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={loadTree}
            title="Refresh Explorer"
            className={`rounded p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors ${
              isLoading ? 'animate-spin' : ''
            }`}
          >
            <RotateCw size={13} />
          </button>
          <button
            onClick={handleCollapseAll}
            title="Collapse All Folders"
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors"
          >
            <FolderTree size={13} />
          </button>
        </div>
      </div>

      {/* Root creation line */}
      {creatingType && targetParentPath === '' && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/20 border-b border-purple-500/20">
          {creatingType === 'file' ? (
            <FileCode2 size={13} className="text-purple-400 shrink-0" />
          ) : (
            <FolderClosed size={13} className="text-purple-400 shrink-0" />
          )}
          <input
            type="text"
            placeholder={creatingType === 'file' ? 'filename.ts' : 'folder-name'}
            value={newEntryName}
            onChange={(e) => setNewEntryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateEntry();
              if (e.key === 'Escape') setCreatingType(null);
            }}
            onBlur={handleCreateEntry}
            autoFocus
            className="h-6 flex-1 rounded border border-purple-500/60 bg-black/80 px-1.5 text-[12px] text-white outline-none"
          />
        </div>
      )}

      {/* Directory tree list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {renderNodes(treeData)}
        {treeData.length === 0 && !isLoading && (
          <div className="p-4 text-center text-xs text-zinc-500">
            No files in workspace. Click '+' to create one.
          </div>
        )}
      </div>

      {/* Right click node context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-44 rounded-lg border border-white/[0.1] bg-[#141419] p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y + 4, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.isDir && (
            <>
              <button
                onClick={() => {
                  setCreatingType('file');
                  setTargetParentPath(contextMenu.node.path);
                  setExpandedPaths((prev) => new Set([...prev, contextMenu.node.path]));
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
              >
                <FilePlus size={13} />
                <span>New File</span>
              </button>
              <button
                onClick={() => {
                  setCreatingType('folder');
                  setTargetParentPath(contextMenu.node.path);
                  setExpandedPaths((prev) => new Set([...prev, contextMenu.node.path]));
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
              >
                <FolderPlus size={13} />
                <span>New Folder</span>
              </button>
              <div className="my-1 border-t border-white/[0.06]" />
            </>
          )}

          <button
            onClick={() => {
              setRenamingPath(contextMenu.node.path);
              setRenameValue(contextMenu.node.name);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            <Edit2 size={13} />
            <span>Rename</span>
          </button>

          <button
            onClick={() => {
              handleDeleteEntry(contextMenu.node.path);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
};
