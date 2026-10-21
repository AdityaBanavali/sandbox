import React from 'react';
import Editor from '@monaco-editor/react';
import { Play, Sparkles, RotateCcw, Trash2, Code, Zap } from 'lucide-react';

export default function CodeEditor({
  code,
  setCode,
  language,
  setLanguage,
  mode,
  setMode,
  onVisualize,
  isLoading,
  onResetCode,
}) {
  const lineCount = code ? code.split('\n').length : 0;

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onVisualize();
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel border-r border-border-subtle" onKeyDown={handleKeyDown}>
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-panel-header/90 border-b border-border-subtle text-slate-300">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Code className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Source Code
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full">
            {lineCount} lines
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-card border border-border-subtle text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 transition font-mono"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>

          {/* Reset button */}
          <button
            onClick={onResetCode}
            title="Reset to sample"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Clear button */}
          <button
            onClick={() => setCode('')}
            title="Clear editor"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mode Switcher Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-border-subtle/80 text-xs">
        <span className="text-[11px] font-semibold text-slate-400">Analysis Mode:</span>
        <div className="flex items-center gap-1 bg-card p-0.5 rounded-lg border border-border-subtle">
          <button
            type="button"
            onClick={() => setMode('architecture')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition ${
              mode === 'architecture'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Architecture
          </button>
          <button
            type="button"
            onClick={() => setMode('control_flow')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition ${
              mode === 'control_flow'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Control Flow
          </button>
          <button
            type="button"
            onClick={() => setMode('data_flow')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition ${
              mode === 'data_flow'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Data Flow
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
        <Editor
          height="100%"
          language={language === 'python' ? 'python' : (language === 'typescript' ? 'typescript' : 'javascript')}
          theme="vs-dark"
          value={code}
          onChange={(val) => setCode(val || '')}
          options={{
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
            fontSize: 13,
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            tabSize: 4,
            bracketPairColorization: { enabled: true },
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
        />
      </div>

      {/* Bottom Action Footer */}
      <div className="p-3 bg-panel-header/90 border-t border-border-subtle flex items-center justify-between gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Press</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-card border border-border-subtle rounded text-slate-300">
            ⌘ Enter
          </kbd>
          <span>to visualize</span>
        </div>

        <button
          onClick={onVisualize}
          disabled={isLoading || !code.trim()}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs tracking-wide text-white transition-all duration-200 ${
            isLoading || !code.trim()
              ? 'bg-slate-700 cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 active:scale-95'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analyzing Architecture...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
              <span>Generate Architecture Diagram</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
