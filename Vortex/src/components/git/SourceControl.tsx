import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  RotateCw,
  Check,
  FileCode2,
  GitCommit,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  History,
  Archive,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FolderGit2,
} from 'lucide-react';
import { GitService } from '../../services/gitService';
import type { DetailedGitStatus, GitStash } from '../../types/git';

interface SourceControlProps {
  onOpenFile: (path: string) => void;
  accentColor: string;
  onOpenBranchManager: () => void;
  onOpenCommitHistory: () => void;
  onStatusUpdated?: (status: DetailedGitStatus) => void;
}

export const SourceControl: React.FC<SourceControlProps> = ({
  onOpenFile,
  accentColor,
  onOpenBranchManager,
  onOpenCommitHistory,
  onStatusUpdated,
}) => {
  const [gitStatus, setGitStatus] = useState<DetailedGitStatus>({
    branch: 'master',
    isClean: true,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
  });

  const [commitMsg, setCommitMsg] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Stash state
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [showStashPanel, setShowStashPanel] = useState(false);
  const [stashMessage, setStashMessage] = useState('');

  // Accordion collapsed states
  const [stagedOpen, setStagedOpen] = useState(true);
  const [changesOpen, setChangesOpen] = useState(true);
  const [untrackedOpen, setUntrackedOpen] = useState(true);
  const [conflictedOpen, setConflictedOpen] = useState(true);

  const loadGitStatus = async () => {
    setIsRefreshing(true);
    try {
      const status = await GitService.getDetailedStatus();
      setGitStatus(status);
      if (onStatusUpdated) {
        onStatusUpdated(status);
      }
      const stashesList = await GitService.getStashes();
      setStashes(stashesList);
    } catch (err) {
      console.error('Failed to load git status:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadGitStatus();
  }, []);

  const handleStageFile = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await GitService.stagePath(path);
      await loadGitStatus();
    } catch (err) {
      console.error(`Failed to stage ${path}:`, err);
    }
  };

  const handleStageAll = async () => {
    try {
      await GitService.stagePath('.');
      await loadGitStatus();
    } catch (err) {
      console.error('Failed to stage all:', err);
    }
  };

  const handleUnstageFile = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await GitService.unstagePath(path);
      await loadGitStatus();
    } catch (err) {
      console.error(`Failed to unstage ${path}:`, err);
    }
  };

  const handleUnstageAll = async () => {
    try {
      await GitService.unstagePath('.');
      await loadGitStatus();
    } catch (err) {
      console.error('Failed to unstage all:', err);
    }
  };

  const handleDiscardFile = async (path: string, isUntracked = false, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Discard changes to "${path}"? This cannot be undone.`)) return;
    try {
      await GitService.discardPath(path, isUntracked);
      await loadGitStatus();
    } catch (err) {
      console.error(`Failed to discard ${path}:`, err);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim() || isCommitting) return;
    setIsCommitting(true);
    try {
      // If nothing staged but unstaged exists, auto-stage all
      if (gitStatus.staged.length === 0 && (gitStatus.unstaged.length > 0 || gitStatus.untracked.length > 0)) {
        await GitService.stagePath('.');
      }
      await GitService.commit(commitMsg.trim());
      setCommitMsg('');
      await loadGitStatus();
    } catch (err) {
      console.error('Commit failed:', err);
      alert('Git commit failed. Ensure changes are staged.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleGenerateAiCommit = async () => {
    setIsAiGenerating(true);
    try {
      // Fetch diff (staged if available, else working tree)
      let diff = await GitService.getDiff(true);
      if (!diff.trim()) {
        diff = await GitService.getDiff(false);
      }
      if (!diff.trim()) {
        alert('No modifications detected to generate commit message for.');
        return;
      }
      const generated = await GitService.generateAiCommitMessage(diff);
      if (generated) {
        setCommitMsg(generated);
      }
    } catch (err) {
      console.error('AI commit message generation failed:', err);
      alert('Could not generate AI commit message.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleRemoteSync = async () => {
    setIsSyncing(true);
    try {
      await GitService.syncRemote('sync');
      await loadGitStatus();
    } catch (err) {
      console.error('Sync failed:', err);
      alert('Remote sync encountered an error. Check remote configuration.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateStash = async () => {
    try {
      await GitService.stashOp('push', stashMessage.trim() || undefined);
      setStashMessage('');
      setShowStashPanel(false);
      await loadGitStatus();
    } catch (err) {
      console.error('Failed to create stash:', err);
    }
  };

  const handleApplyStash = async (index: number) => {
    try {
      await GitService.stashOp('apply', undefined, index);
      await loadGitStatus();
    } catch (err) {
      console.error('Failed to apply stash:', err);
    }
  };

  const handlePopStash = async (index: number) => {
    try {
      await GitService.stashOp('pop', undefined, index);
      await loadGitStatus();
    } catch (err) {
      console.error('Failed to pop stash:', err);
    }
  };

  const handleDropStash = async (index: number) => {
    if (!confirm(`Delete stash@{${index}}?`)) return;
    try {
      await GitService.stashOp('drop', undefined, index);
      await loadGitStatus();
    } catch (err) {
      console.error('Failed to drop stash:', err);
    }
  };

  const totalModifications =
    gitStatus.staged.length +
    gitStatus.unstaged.length +
    gitStatus.untracked.length +
    gitStatus.conflicted.length;

  return (
    <div className="flex h-full flex-col select-none text-zinc-300">
      {/* Top Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-3 bg-[#0d0d12]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Source Control
          </span>
          {totalModifications > 0 && (
            <span
              className="rounded-full px-1.5 py-0.2 text-[10px] font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {totalModifications}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenCommitHistory}
            title="View Commit History Timeline"
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors"
          >
            <History size={13} />
          </button>

          <button
            onClick={() => setShowStashPanel(!showStashPanel)}
            title="Stash Changes"
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors"
          >
            <Archive size={13} />
          </button>

          <button
            onClick={loadGitStatus}
            title="Refresh Git Status"
            className={`rounded p-1 text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors ${
              isRefreshing ? 'animate-spin' : ''
            }`}
          >
            <RotateCw size={13} />
          </button>
        </div>
      </div>

      {/* Branch & Sync Status Banner */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
        <button
          onClick={onOpenBranchManager}
          className="flex items-center gap-1.5 font-medium text-zinc-200 hover:text-white transition-colors truncate max-w-[170px]"
          title="Click to switch or create branches"
        >
          <GitBranch size={13} style={{ color: accentColor }} />
          <span className="truncate">{gitStatus.branch}</span>
          <ChevronDown size={11} className="text-zinc-500 shrink-0" />
        </button>

        {/* Ahead / Behind Sync Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] shrink-0">
          <div className="flex items-center gap-1 text-zinc-400 font-mono">
            <span title={`${gitStatus.ahead} commits ahead`} className="flex items-center">
              <ArrowUp size={11} className="text-zinc-500" />
              {gitStatus.ahead}
            </span>
            <span title={`${gitStatus.behind} commits behind`} className="flex items-center">
              <ArrowDown size={11} className="text-zinc-500" />
              {gitStatus.behind}
            </span>
          </div>

          <button
            onClick={handleRemoteSync}
            disabled={isSyncing}
            title="Sync with remote (fetch, pull, push)"
            className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-300 hover:bg-white/[0.1] hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Stash Drawer */}
      {showStashPanel && (
        <div className="border-b border-white/[0.08] bg-[#121217] p-3 space-y-2.5 animate-in slide-in-from-top duration-150">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Archive size={13} style={{ color: accentColor }} />
              Git Stashes
            </span>
            <span className="text-[10px] text-zinc-500">{stashes.length} stored</span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={stashMessage}
              onChange={(e) => setStashMessage(e.target.value)}
              placeholder="Stash description..."
              className="flex-1 rounded-md border border-white/[0.08] bg-black/40 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            />
            <button
              onClick={handleCreateStash}
              disabled={totalModifications === 0}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: accentColor }}
            >
              Stash
            </button>
          </div>

          {stashes.length > 0 && (
            <div className="max-h-28 overflow-y-auto space-y-1 divide-y divide-white/[0.04]">
              {stashes.map((s) => (
                <div key={s.index} className="pt-1 text-xs flex items-center justify-between gap-1">
                  <div className="truncate text-zinc-300 text-[11px]">
                    <span className="font-mono text-zinc-500 mr-1">#{s.index}</span>
                    <span>{s.message || 'WIP'}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleApplyStash(s.index)}
                      className="px-1 py-0.5 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => handlePopStash(s.index)}
                      className="px-1 py-0.5 rounded text-[10px] text-emerald-400 hover:bg-emerald-500/10"
                    >
                      Pop
                    </button>
                    <button
                      onClick={() => handleDropStash(s.index)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Commit Input Box */}
      <div className="p-3 border-b border-white/[0.06] bg-[#0c0c10] space-y-2">
        <div className="relative">
          <textarea
            rows={2}
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                handleCommit();
              }
            }}
            placeholder="Commit message (Ctrl+Enter)..."
            className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/40 p-2 pr-8 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
          />

          {/* AI Commit Generator Button */}
          <button
            onClick={handleGenerateAiCommit}
            disabled={isAiGenerating || totalModifications === 0}
            title="AI Commit Message Generator (analyzes staged diff)"
            className="absolute right-2 top-2 rounded-md p-1 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-colors disabled:opacity-30"
          >
            <Sparkles size={14} className={isAiGenerating ? 'animate-spin' : ''} />
          </button>
        </div>

        <button
          onClick={handleCommit}
          disabled={!commitMsg.trim() || isCommitting || totalModifications === 0}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-medium text-white transition-all disabled:opacity-40 shadow-xs"
          style={{ backgroundColor: accentColor }}
        >
          <GitCommit size={13} />
          <span>{isCommitting ? 'Committing...' : 'Commit Changes'}</span>
        </button>
      </div>

      {/* File Accordion Groups */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* 1. Merge Conflicts Accordion */}
        {gitStatus.conflicted.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 overflow-hidden">
            <div
              onClick={() => setConflictedOpen(!conflictedOpen)}
              className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 cursor-pointer hover:bg-amber-500/10 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {conflictedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <AlertTriangle size={12} className="text-amber-400" />
                <span>MERGE CONFLICTS</span>
              </div>
              <span className="rounded-full bg-amber-500/30 px-1.5 text-[10px] text-amber-200 font-bold">
                {gitStatus.conflicted.length}
              </span>
            </div>

            {conflictedOpen && (
              <div className="p-1 space-y-0.5">
                {gitStatus.conflicted.map((path) => (
                  <button
                    key={path}
                    onClick={() => onOpenFile(path)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-amber-200 hover:bg-amber-500/20 transition-colors"
                  >
                    <span className="truncate font-mono text-[11.5px]">{path}</span>
                    <span className="rounded bg-amber-500/40 px-1 text-[9.5px] font-bold">
                      CONFLICT
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Staged Changes Accordion */}
        <div>
          <div
            onClick={() => setStagedOpen(!stagedOpen)}
            className="flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-200"
          >
            <div className="flex items-center gap-1">
              {stagedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Staged Changes</span>
              <span className="ml-1 rounded-full bg-white/[0.08] px-1.5 text-[10px] text-zinc-300">
                {gitStatus.staged.length}
              </span>
            </div>

            {gitStatus.staged.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnstageAll();
                }}
                title="Unstage All Changes"
                className="rounded p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors"
              >
                <Minus size={13} />
              </button>
            )}
          </div>

          {stagedOpen && (
            <div className="space-y-0.5 mt-0.5">
              {gitStatus.staged.map((file) => (
                <div
                  key={file.path}
                  onClick={() => onOpenFile(file.path)}
                  className="group flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[12px] text-zinc-300 hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode2 size={13} className="text-zinc-500 shrink-0" />
                    <span className="truncate">{file.path}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={(e) => handleUnstageFile(file.path, e)}
                      title="Unstage File"
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] transition-all"
                    >
                      <Minus size={12} />
                    </button>
                    <span
                      className={`text-[11px] font-mono font-bold w-4 text-center ${
                        file.status === 'M'
                          ? 'text-amber-400'
                          : file.status === 'A'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {file.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Changes (Unstaged) Accordion */}
        <div>
          <div
            onClick={() => setChangesOpen(!changesOpen)}
            className="flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-200"
          >
            <div className="flex items-center gap-1">
              {changesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Changes</span>
              <span className="ml-1 rounded-full bg-white/[0.08] px-1.5 text-[10px] text-zinc-300">
                {gitStatus.unstaged.length}
              </span>
            </div>

            {gitStatus.unstaged.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageAll();
                }}
                title="Stage All Changes"
                className="rounded p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors"
              >
                <Plus size={13} />
              </button>
            )}
          </div>

          {changesOpen && (
            <div className="space-y-0.5 mt-0.5">
              {gitStatus.unstaged.map((file) => (
                <div
                  key={file.path}
                  onClick={() => onOpenFile(file.path)}
                  className="group flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[12px] text-zinc-300 hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode2 size={13} className="text-zinc-500 shrink-0" />
                    <span className="truncate">{file.path}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={(e) => handleDiscardFile(file.path, false, e)}
                      title="Discard Changes"
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                    <button
                      onClick={(e) => handleStageFile(file.path, e)}
                      title="Stage File"
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] transition-all"
                    >
                      <Plus size={12} />
                    </button>
                    <span
                      className={`text-[11px] font-mono font-bold w-4 text-center ${
                        file.status === 'M'
                          ? 'text-amber-400'
                          : file.status === 'D'
                          ? 'text-red-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {file.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Untracked Files Accordion */}
        {gitStatus.untracked.length > 0 && (
          <div>
            <div
              onClick={() => setUntrackedOpen(!untrackedOpen)}
              className="flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-200"
            >
              <div className="flex items-center gap-1">
                {untrackedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Untracked</span>
                <span className="ml-1 rounded-full bg-white/[0.08] px-1.5 text-[10px] text-zinc-300">
                  {gitStatus.untracked.length}
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageAll();
                }}
                title="Stage All Untracked Files"
                className="rounded p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>

            {untrackedOpen && (
              <div className="space-y-0.5 mt-0.5">
                {gitStatus.untracked.map((path) => (
                  <div
                    key={path}
                    onClick={() => onOpenFile(path)}
                    className="group flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[12px] text-zinc-300 hover:bg-white/[0.05] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode2 size={13} className="text-zinc-500 shrink-0" />
                      <span className="truncate">{path}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={(e) => handleDiscardFile(path, true, e)}
                        title="Delete Untracked File"
                        className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        onClick={(e) => handleStageFile(path, e)}
                        title="Stage Untracked File"
                        className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] transition-all"
                      >
                        <Plus size={12} />
                      </button>
                      <span className="text-[11px] font-mono font-bold w-4 text-center text-emerald-400">
                        U
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {totalModifications === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
            <Check size={28} className="text-emerald-500/50 mb-2" />
            <p className="text-xs font-medium text-zinc-400">Working tree clean</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">No changes detected</p>
          </div>
        )}
      </div>
    </div>
  );
};
