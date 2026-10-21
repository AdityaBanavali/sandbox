import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  GitCommit,
  Search,
  X,
  Copy,
  Check,
  User,
  Clock,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import { GitService } from '../../services/gitService';
import type { GitCommit as GitCommitType } from '../../types/git';

interface CommitHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  currentBranch: string;
}

export const CommitHistoryModal: React.FC<CommitHistoryModalProps> = ({
  isOpen,
  onClose,
  accentColor,
  currentBranch,
}) => {
  const [commits, setCommits] = useState<GitCommitType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const history = await GitService.getLog(50);
      setCommits(history);
    } catch (err) {
      console.error('Failed to load commit history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setSearchQuery('');
      setCopiedHash(null);
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

  const filteredCommits = useMemo(() => {
    if (!searchQuery.trim()) return commits;
    const q = searchQuery.toLowerCase().trim();
    return commits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) ||
        c.shortHash.toLowerCase().includes(q) ||
        c.authorName.toLowerCase().includes(q)
    );
  }, [commits, searchQuery]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-[#121217] shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              <History size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100">Commit History</h2>
                <span className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                  <GitBranch size={10} style={{ color: accentColor }} />
                  {currentBranch}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Timeline of repository commits, hashes, and authors
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

        {/* Search Bar */}
        <div className="p-3 border-b border-white/[0.06] bg-[#0d0d12]">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search commit messages, authors, or hashes..."
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Commit Graph Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-0 min-h-[300px]">
          {filteredCommits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500">
              <GitCommit size={32} className="opacity-40 mb-2" />
              <p className="text-xs">No commits found</p>
            </div>
          ) : (
            filteredCommits.map((commit, index) => {
              const isLast = index === filteredCommits.length - 1;
              const isCopied = copiedHash === commit.shortHash || copiedHash === commit.hash;

              return (
                <div key={commit.hash} className="relative flex gap-3 pb-6 group">
                  {/* Timeline branch line & dot */}
                  <div className="flex flex-col items-center">
                    <div
                      className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#1a1a24] shadow-xs group-hover:scale-110 transition-transform"
                      style={{ borderColor: accentColor }}
                    >
                      <GitCommit size={12} style={{ color: accentColor }} />
                    </div>
                    {!isLast && (
                      <div className="w-[1.5px] grow bg-white/[0.08] group-hover:bg-white/[0.15] transition-colors" />
                    )}
                  </div>

                  {/* Content card */}
                  <div className="flex-1 -mt-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 group-hover:border-white/10 group-hover:bg-white/[0.04] transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-zinc-200 leading-snug">
                        {commit.message}
                      </p>

                      {/* Hash Copy Badge */}
                      <button
                        onClick={() => handleCopyHash(commit.shortHash)}
                        title="Copy commit SHA"
                        className="flex items-center gap-1 rounded bg-black/40 border border-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-colors shrink-0"
                      >
                        {isCopied ? (
                          <>
                            <Check size={10} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <span>{commit.shortHash}</span>
                            <Copy size={9} className="opacity-60" />
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                      <span className="flex items-center gap-1 text-zinc-300">
                        <User size={11} className="text-zinc-500" />
                        <span>{commit.authorName}</span>
                      </span>

                      <span className="flex items-center gap-1 text-zinc-500">
                        <Clock size={11} />
                        <span>{commit.relativeTime}</span>
                      </span>

                      <span className="text-zinc-600 font-mono text-[10px] truncate max-w-[200px]">
                        {commit.date}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 bg-white/[0.01] text-[11px] text-zinc-500">
          <span>{filteredCommits.length} commits listed</span>
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
