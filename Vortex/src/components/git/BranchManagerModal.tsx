import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  Check,
  Search,
  X,
  AlertCircle,
  ArrowRight,
  FolderGit2,
} from 'lucide-react';
import { GitService } from '../../services/gitService';
import type { GitBranch as GitBranchType } from '../../types/git';

interface BranchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  currentBranch: string;
  onBranchSwitched: (newBranch: string) => void;
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({
  isOpen,
  onClose,
  accentColor,
  currentBranch,
  onBranchSwitched,
}) => {
  const [branches, setBranches] = useState<GitBranchType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchBranches = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const list = await GitService.getBranches();
      setBranches(list);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to fetch git branches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBranches();
      setSearchQuery('');
      setNewBranchName('');
      setIsCreating(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredBranches = useMemo(() => {
    return branches.filter((b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [branches, searchQuery]);

  const handleCheckout = async (branchName: string) => {
    if (branchName === currentBranch) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await GitService.checkoutBranch(branchName, false);
      onBranchSwitched(branchName);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || `Failed to switch to ${branchName}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    const cleanName = newBranchName.trim().replace(/\s+/g, '-');
    if (!cleanName) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await GitService.checkoutBranch(cleanName, true);
      onBranchSwitched(cleanName);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || `Failed to create branch ${cleanName}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBranch = async (e: React.MouseEvent, branchName: string) => {
    e.stopPropagation();
    if (branchName === currentBranch) {
      setErrorMessage('Cannot delete the currently checked out branch.');
      return;
    }
    if (!confirm(`Are you sure you want to delete branch "${branchName}"?`)) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await GitService.deleteBranch(branchName, false);
      await fetchBranches();
    } catch (err: any) {
      // Prompt force delete
      if (confirm(`Branch not fully merged. Force delete "${branchName}"?`)) {
        try {
          await GitService.deleteBranch(branchName, true);
          await fetchBranches();
        } catch (forceErr: any) {
          setErrorMessage(forceErr?.message || `Failed to force delete ${branchName}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#121217] shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <GitBranch size={15} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Git Branches</h2>
              <p className="text-[11px] text-zinc-400">
                Switch, create, and manage repository branches
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        {/* Action / Search Bar */}
        <div className="p-3 border-b border-white/[0.06] bg-[#0d0d12] flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter branches or search..."
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <Plus size={13} />
            <span>New Branch</span>
          </button>
        </div>

        {/* New Branch Form Drawer */}
        {isCreating && (
          <div className="border-b border-white/[0.08] bg-white/[0.02] p-3 animate-in slide-in-from-top duration-150 space-y-2">
            <label className="text-[11px] font-medium text-zinc-400 block">
              Create and switch to new branch from <span className="text-zinc-200 font-mono font-semibold">{currentBranch}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                placeholder="branch-name (e.g. feat/login-screen)"
                className="flex-1 rounded-lg border border-white/[0.1] bg-black/60 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1"
                style={{ outlineColor: accentColor }}
                autoFocus
              />
              <button
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim() || isLoading}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-40"
                style={{ backgroundColor: accentColor }}
              >
                <ArrowRight size={13} />
                <span>Create & Checkout</span>
              </button>
            </div>
          </div>
        )}

        {/* Branch List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[220px]">
          {filteredBranches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500">
              <FolderGit2 size={32} className="opacity-40 mb-2" />
              <p className="text-xs">No branches found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredBranches.map((branch) => {
              const isSelected = branch.name === currentBranch || branch.isCurrent;
              return (
                <div
                  key={branch.name}
                  onClick={() => handleCheckout(branch.name)}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.08] text-white border border-white/10'
                      : 'text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <GitBranch
                      size={14}
                      className={isSelected ? 'shrink-0' : 'text-zinc-500 group-hover:text-zinc-300 shrink-0'}
                      style={isSelected ? { color: accentColor } : undefined}
                    />
                    <div className="truncate flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{branch.name}</span>
                        {isSelected && (
                          <span
                            className="rounded-full px-1.5 py-0.2 text-[9.5px] font-semibold text-white tracking-wide"
                            style={{ backgroundColor: accentColor }}
                          >
                            HEAD
                          </span>
                        )}
                        {branch.isRemote && (
                          <span className="rounded bg-white/[0.06] px-1 text-[9.5px] text-zinc-400 font-mono">
                            remote
                          </span>
                        )}
                      </div>
                      {branch.commitMessage && (
                        <span className="text-[10.5px] text-zinc-500 truncate max-w-sm mt-0.5">
                          {branch.commitHash && (
                            <span className="font-mono text-zinc-400 mr-1.5">{branch.commitHash}</span>
                          )}
                          {branch.commitMessage}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {isSelected ? (
                      <Check size={14} style={{ color: accentColor }} />
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleDeleteBranch(e, branch.name)}
                          title={`Delete branch ${branch.name}`}
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                        <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300">
                          Switch
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 bg-white/[0.01] text-[11px] text-zinc-500">
          <span>
            {branches.length} branch{branches.length === 1 ? '' : 'es'} total
          </span>
          <div className="flex items-center gap-1.5">
            <kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              Esc
            </kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
