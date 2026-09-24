import React, { useState } from 'react';
import {
  GitMerge,
  Check,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Split,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AiService } from '../../services/aiService';
import type { ConflictBlock } from '../../types/git';

interface ConflictResolverProps {
  conflicts: ConflictBlock[];
  filePath: string;
  accentColor: string;
  onResolveBlock: (
    blockId: string,
    resolvedContent: string,
    startLine: number,
    endLine: number
  ) => void;
  onResolveAll: () => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  filePath,
  accentColor,
  onResolveBlock,
  onResolveAll,
}) => {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (conflicts.length === 0) return null;

  const handleAcceptCurrent = (block: ConflictBlock) => {
    onResolveBlock(block.id, block.currentContent, block.startLine, block.endLine);
  };

  const handleAcceptIncoming = (block: ConflictBlock) => {
    onResolveBlock(block.id, block.incomingContent, block.startLine, block.endLine);
  };

  const handleAcceptBoth = (block: ConflictBlock) => {
    const combined = `${block.currentContent}\n${block.incomingContent}`;
    onResolveBlock(block.id, combined, block.startLine, block.endLine);
  };

  const handleAiResolve = async (block: ConflictBlock) => {
    setResolvingId(block.id);
    try {
      const prompt = `You are resolving a Git merge conflict in file: ${filePath}.
Intelligently combine and resolve the following conflicting changes without conflict markers. Keep necessary imports, logic, and types from both sides without breaking syntax.
Output ONLY the final merged code. No explanations, no markdown blocks.

<<<<<<< CURRENT (${block.currentLabel})
${block.currentContent}
=======
${block.incomingContent}
>>>>>>> INCOMING (${block.incomingLabel})`;

      const result = await AiService.sendPrompt(prompt);
      let cleaned = result.text.trim();
      cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
      onResolveBlock(block.id, cleaned, block.startLine, block.endLine);
    } catch (err) {
      console.error('AI conflict resolution failed:', err);
      alert('AI conflict resolution failed. Please resolve manually.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-950/20 p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-amber-300">
            Merge Conflict Detected ({conflicts.length} block{conflicts.length === 1 ? '' : 's'})
          </span>
          <span className="font-mono text-[11px] text-zinc-400 truncate max-w-xs">
            {filePath}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {conflicts.map((block, idx) => {
          const isResolving = resolvingId === block.id;

          return (
            <div
              key={block.id}
              className="rounded-lg border border-white/10 bg-black/40 overflow-hidden shadow-xs"
            >
              {/* Conflict Action Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs">
                <span className="text-[11px] font-mono text-zinc-400">
                  Conflict #{idx + 1} (Lines {block.startLine}–{block.endLine})
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleAcceptCurrent(block)}
                    disabled={isResolving}
                    className="flex items-center gap-1 rounded bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[11px] font-medium text-blue-300 hover:bg-blue-500/25 transition-colors disabled:opacity-40"
                  >
                    <ArrowDownLeft size={11} />
                    <span>Accept Current</span>
                  </button>

                  <button
                    onClick={() => handleAcceptIncoming(block)}
                    disabled={isResolving}
                    className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
                  >
                    <ArrowUpRight size={11} />
                    <span>Accept Incoming</span>
                  </button>

                  <button
                    onClick={() => handleAcceptBoth(block)}
                    disabled={isResolving}
                    className="flex items-center gap-1 rounded bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[11px] font-medium text-purple-300 hover:bg-purple-500/25 transition-colors disabled:opacity-40"
                  >
                    <Split size={11} />
                    <span>Accept Both</span>
                  </button>

                  <button
                    onClick={() => handleAiResolve(block)}
                    disabled={isResolving}
                    className="flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30 transition-all disabled:opacity-40 shadow-xs"
                  >
                    <Sparkles size={11} className={isResolving ? 'animate-spin' : ''} />
                    <span>{isResolving ? 'Resolving...' : 'AI Resolve'}</span>
                  </button>
                </div>
              </div>

              {/* Side-by-side or stacked diff representation */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.08] text-xs font-mono">
                {/* Current */}
                <div className="p-2.5 bg-blue-950/15">
                  <div className="mb-1 text-[10.5px] font-semibold text-blue-400">
                    Current Change ({block.currentLabel || 'HEAD'})
                  </div>
                  <pre className="overflow-x-auto text-[11px] text-zinc-300 whitespace-pre-wrap">
                    {block.currentContent || <span className="italic text-zinc-600">(empty)</span>}
                  </pre>
                </div>

                {/* Incoming */}
                <div className="p-2.5 bg-emerald-950/15">
                  <div className="mb-1 text-[10.5px] font-semibold text-emerald-400">
                    Incoming Change ({block.incomingLabel || 'Incoming'})
                  </div>
                  <pre className="overflow-x-auto text-[11px] text-zinc-300 whitespace-pre-wrap">
                    {block.incomingContent || <span className="italic text-zinc-600">(empty)</span>}
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
