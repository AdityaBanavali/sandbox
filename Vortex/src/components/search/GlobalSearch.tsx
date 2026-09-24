import React, { useState, useEffect } from 'react';
import {
  Search,
  Replace,
  ChevronRight,
  ChevronDown,
  FileCode2,
  Check,
  RefreshCw,
} from 'lucide-react';
import { TauriBridge } from '../../services/tauriBridge';
import type { SearchFileResult } from '../../types/editor';

interface GlobalSearchProps {
  onNavigateToMatch: (path: string, lineNumber: number) => void;
  accentColor: string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigateToMatch, accentColor }) => {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isReplaceVisible, setIsReplaceVisible] = useState(false);

  // Search flags
  const [matchCase, setMatchCase] = useState(false);
  const [matchWord, setMatchWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  const [results, setResults] = useState<SearchFileResult[]>([]);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const searchRes = await TauriBridge.searchWorkspace(query, {
        isRegex,
        matchCase,
        matchWord,
      });
      setResults(searchRes);
    } catch (err) {
      console.error('Workspace search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, matchCase, matchWord, isRegex]);

  const toggleFileCollapse = (path: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleReplaceAll = async () => {
    if (!query.trim() || results.length === 0) return;

    for (const file of results) {
      try {
        const originalContent = await TauriBridge.readFile(file.path);
        let updatedContent = originalContent;

        if (isRegex) {
          const flags = matchCase ? 'g' : 'gi';
          const reg = new RegExp(matchWord ? `\\b${query}\\b` : query, flags);
          updatedContent = originalContent.replace(reg, replaceText);
        } else {
          if (matchCase) {
            updatedContent = originalContent.split(query).join(replaceText);
          } else {
            const reg = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            updatedContent = originalContent.replace(reg, replaceText);
          }
        }

        await TauriBridge.writeFile(file.path, updatedContent);
      } catch (err) {
        console.error(`Failed to replace in file ${file.path}:`, err);
      }
    }

    await performSearch();
  };

  const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);

  return (
    <div className="flex h-full flex-col select-none text-zinc-300">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          Search Workspace
        </span>
        <button
          onClick={() => setIsReplaceVisible(!isReplaceVisible)}
          title="Toggle Replace"
          className={`rounded p-1 transition-colors ${
            isReplaceVisible ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          <Replace size={13} />
        </button>
      </div>

      {/* Inputs container */}
      <div className="space-y-2 p-3 border-b border-white/[0.06] bg-[#0c0c10]">
        {/* Search input with toggle icons */}
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search workspace (Ctrl+Shift+F)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && performSearch()}
            className="w-full rounded-lg border border-white/[0.08] bg-black/40 py-1.5 pl-3 pr-20 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/60 focus:outline-none"
          />

          <div className="absolute right-1 flex items-center gap-0.5">
            <button
              onClick={() => setMatchCase(!matchCase)}
              title="Match Case (Aa)"
              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-colors ${
                matchCase ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Aa
            </button>
            <button
              onClick={() => setMatchWord(!matchWord)}
              title="Match Whole Word (\b)"
              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold font-mono transition-colors ${
                matchWord ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              \b
            </button>
            <button
              onClick={() => setIsRegex(!isRegex)}
              title="Use Regular Expression (.*)"
              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold font-mono transition-colors ${
                isRegex ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              .*
            </button>
          </div>
        </div>

        {/* Replace input */}
        {isReplaceVisible && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="flex-1 rounded-lg border border-white/[0.08] bg-black/40 py-1.5 px-3 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/60 focus:outline-none"
            />
            <button
              onClick={handleReplaceAll}
              disabled={results.length === 0}
              title="Replace All across workspace"
              className="flex h-7 items-center gap-1 rounded-md bg-purple-600/80 hover:bg-purple-600 px-2 text-[11px] font-medium text-white transition-all disabled:opacity-40"
            >
              <Check size={11} />
              <span>All</span>
            </button>
          </div>
        )}

        {/* Status result summary */}
        {query.trim() && (
          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
            <span>
              {isSearching ? (
                <span className="flex items-center gap-1">
                  <RefreshCw size={10} className="animate-spin" /> Searching...
                </span>
              ) : (
                `${totalMatches} result${totalMatches === 1 ? '' : 's'} in ${results.length} file${results.length === 1 ? '' : 's'}`
              )}
            </span>
          </div>
        )}
      </div>

      {/* Results Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {results.map((file) => {
          const isCollapsed = collapsedFiles.has(file.path);
          return (
            <div key={file.path} className="flex flex-col">
              {/* File header */}
              <button
                onClick={() => toggleFileCollapse(file.path)}
                className="flex items-center justify-between rounded px-2 py-1 text-left text-[12px] font-medium text-zinc-300 hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isCollapsed ? (
                    <ChevronRight size={12} className="shrink-0 text-zinc-500" />
                  ) : (
                    <ChevronDown size={12} className="shrink-0 text-zinc-500" />
                  )}
                  <FileCode2 size={13} className="text-purple-400 shrink-0" />
                  <span className="truncate">{file.fileName}</span>
                  <span className="text-[10px] text-zinc-500 truncate font-mono">
                    {file.path}
                  </span>
                </div>
                <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] text-zinc-400">
                  {file.matches.length}
                </span>
              </button>

              {/* Match lines */}
              {!isCollapsed && (
                <div className="pl-6 space-y-0.5 pt-0.5 font-mono text-[11px]">
                  {file.matches.map((m, idx) => (
                    <div
                      key={idx}
                      onClick={() => onNavigateToMatch(file.path, m.lineNumber)}
                      className="group flex cursor-pointer items-start gap-2 rounded px-2 py-0.5 hover:bg-purple-950/30 hover:text-zinc-100 transition-colors"
                    >
                      <span className="shrink-0 text-zinc-500">{m.lineNumber}:</span>
                      <span className="truncate text-zinc-400 group-hover:text-zinc-200">
                        {m.lineContent.substring(0, m.matchStart)}
                        <span className="rounded bg-purple-500/40 px-0.5 font-bold text-white">
                          {m.lineContent.substring(m.matchStart, m.matchEnd)}
                        </span>
                        {m.lineContent.substring(m.matchEnd)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {query.trim() && results.length === 0 && !isSearching && (
          <div className="p-4 text-center text-xs text-zinc-500">
            No matching occurrences found for "{query}".
          </div>
        )}
      </div>
    </div>
  );
};
