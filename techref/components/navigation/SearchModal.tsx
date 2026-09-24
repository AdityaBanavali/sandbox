"use client";

import React, { useState, useEffect, useMemo, useRef, useId } from "react";
import { SearchDocEntry } from "@/types/techref-spec";

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  indexData: SearchDocEntry[];
  onSelect: (item: SearchDocEntry) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  indexData,
  onSelect,
}) => {
  const searchInputId = useId();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return indexData.slice(0, 8);
    const q = query.toLowerCase();
    return indexData
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
      )
      .slice(0, 10);
  }, [query, indexData]);

  const handleKeyDownInList = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      onSelect(results[selectedIndex]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#090d18] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownInList}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-5 py-4 border-b border-white/10 gap-3 bg-[#0c1220]">
          <svg className="w-5 h-5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id={searchInputId}
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type to search API operations, schemas, parameters, SDKs (↑↓ to navigate)..."
            className="w-full bg-transparent text-sm font-mono text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto divide-y divide-white/5 p-2 bg-[#060912]">
          {results.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-slate-500">
              No matching specifications or guides found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                  selectedIndex === idx
                    ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-200"
                    : "text-slate-300 hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
                        item.type === "endpoint"
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : item.type === "guide"
                          ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-white">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{item.subtitle}</p>
                </div>
                <span className="text-slate-500 text-[10px] font-mono shrink-0 ml-3">⏎ enter</span>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 bg-[#0a0f1d] text-[11px] font-mono text-slate-500">
          <div>TechRef Fuzzy Search Index</div>
          <div className="flex items-center gap-2">
            <span>Navigate: ↑ ↓</span>
            <span>Select: ⏎</span>
          </div>
        </div>
      </div>
    </div>
  );
};
