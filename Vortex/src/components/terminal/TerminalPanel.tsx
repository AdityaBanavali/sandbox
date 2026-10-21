import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Trash2,
  Terminal as TerminalIcon,
  Clock,
  RefreshCw,
  Square,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { TauriBridge } from '../../services/tauriBridge';
import type { TerminalLine } from '../../types/editor';

interface TerminalPanelProps {
  workspaceRoot?: string;
  accentColor: string;
}

const stripAnsi = (str: string) => str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ workspaceRoot, accentColor }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'init-1',
      type: 'system',
      content: '⚡ Vortex Shell Emulator live. Type commands below and press Enter.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [lines]);

  // Focus input automatically on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  }, []);

  const handleInterrupt = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        type: 'stderr',
        content: '^C (Process interrupted by user)',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleRunCommand = async (cmdToRun?: string) => {
    const command = (cmdToRun ?? inputVal).trim();
    if (!command) return;

    if (command.toLowerCase() === 'clear') {
      setLines([]);
      setInputVal('');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    const newCmdLine: TerminalLine = {
      id: Math.random().toString(),
      type: 'command',
      content: command,
      timestamp: new Date().toLocaleTimeString(),
    };

    setLines((prev) => [...prev, newCmdLine]);
    if (!cmdToRun) {
      setHistory((prev) => [command, ...prev.filter((c) => c !== command)]);
      setHistoryIndex(-1);
      setInputVal('');
    }

    setIsRunning(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await TauriBridge.executeShell(command, workspaceRoot);

      if (controller.signal.aborted) return;

      const resultLines: TerminalLine[] = [];
      const isSuccess = result.exitCode === 0;

      // Clean ANSI output
      const cleanStdout = stripAnsi(result.stdout || '').trimEnd();
      const cleanStderr = stripAnsi(result.stderr || '').trimEnd();

      if (cleanStdout) {
        resultLines.push({
          id: Math.random().toString(),
          type: 'stdout',
          content: cleanStdout,
          timestamp: `${result.durationMs}ms`,
        });
      }

      // If command succeeded (exitCode === 0), stderr contains informational/build output
      // (e.g. Cargo prints "Compiling", "Finished dev profile" to stderr).
      // Only treat stderr as an actual error if exitCode !== 0.
      if (cleanStderr) {
        resultLines.push({
          id: Math.random().toString(),
          type: isSuccess ? 'stdout' : 'stderr',
          content: cleanStderr,
          timestamp: `${result.durationMs}ms`,
        });
      }

      // Status exit line
      resultLines.push({
        id: Math.random().toString(),
        type: 'system',
        content: isSuccess
          ? `✔ Process completed with code 0 in ${result.durationMs}ms`
          : `✖ Process exited with code ${result.exitCode} in ${result.durationMs}ms`,
        timestamp: new Date().toLocaleTimeString(),
      });

      setLines((prev) => [...prev, ...resultLines]);
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setLines((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            type: 'stderr',
            content: `Execution error: ${String(err?.message || err)}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+C to interrupt
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      if (isRunning) {
        e.preventDefault();
        handleInterrupt();
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleRunCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const quickCommands = [
    { label: 'cargo check', cmd: 'cargo check' },
    { label: 'git status', cmd: 'git status' },
    { label: 'ls -la', cmd: 'ls -la' },
    { label: 'pwd', cmd: 'pwd' },
    { label: 'echo "hello"', cmd: 'echo "Hello Vortex IDE"' },
  ];

  // Helper to format line content intelligently
  const renderOutputLine = (text: string, isError: boolean) => {
    const rawLines = text.split('\n');

    return rawLines.map((l, i) => {
      const trimmed = l.trimStart();

      // If it's a real failure/error
      if (isError || trimmed.startsWith('error:') || trimmed.startsWith('Error:') || trimmed.startsWith('fatal:')) {
        return (
          <div key={i} className="text-red-400 whitespace-pre font-mono">
            {l}
          </div>
        );
      }

      // Warnings
      if (trimmed.startsWith('warning:') || trimmed.startsWith('Warning:')) {
        return (
          <div key={i} className="text-amber-300 whitespace-pre font-mono">
            {l}
          </div>
        );
      }

      // Cargo build status lines: Finished, Compiling, Checking
      if (
        trimmed.startsWith('Finished') ||
        trimmed.startsWith('Compiling') ||
        trimmed.startsWith('Checking') ||
        trimmed.startsWith('Downloaded')
      ) {
        const parts = trimmed.split(' ');
        const keyword = parts[0];
        const rest = parts.slice(1).join(' ');

        return (
          <div key={i} className="whitespace-pre font-mono">
            <span className="text-emerald-400 font-bold">{keyword} </span>
            <span className="text-zinc-200">{rest}</span>
          </div>
        );
      }

      // Normal console line
      return (
        <div key={i} className="text-zinc-300 whitespace-pre font-mono">
          {l}
        </div>
      );
    });
  };

  return (
    <div
      className="flex h-full flex-col font-mono text-[12.5px] bg-[#0c0c10] select-text cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Top action bar */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-1 bg-[#101015] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <span className="text-[11px] font-semibold text-zinc-500 mr-1.5 flex items-center gap-1">
            <TerminalIcon size={12} /> SCRIPTS:
          </span>
          {quickCommands.map((qc) => (
            <button
              key={qc.cmd}
              onClick={() => handleRunCommand(qc.cmd)}
              className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-300 transition-all hover:border-white/[0.2] hover:bg-white/[0.08] active:scale-95"
            >
              <Play size={9} className="text-emerald-400" />
              <span>{qc.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={handleInterrupt}
              className="flex items-center gap-1 rounded bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-500/30"
              title="Stop running command (Ctrl+C)"
            >
              <Square size={10} className="fill-red-400" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={() => setLines([])}
            title="Clear Terminal Output"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-zinc-200"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal log output */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 leading-relaxed selection:bg-purple-900/50">
        {lines.map((line) => {
          if (line.type === 'command') {
            return (
              <div key={line.id} className="flex items-start gap-2 text-zinc-100 font-semibold pt-1">
                <span className="text-purple-400 select-none">❯</span>
                <span className="text-emerald-400 select-none">vortex:~$</span>
                <span className="flex-1 select-text">{line.content}</span>
                <span className="text-[10px] text-zinc-600 font-normal select-none flex items-center gap-0.5">
                  <Clock size={10} /> {line.timestamp}
                </span>
              </div>
            );
          }

          if (line.type === 'stderr') {
            return (
              <div key={line.id} className="pl-5">
                {renderOutputLine(line.content, true)}
              </div>
            );
          }

          if (line.type === 'system') {
            const isOk = line.content.startsWith('✔');
            const isErr = line.content.startsWith('✖');

            return (
              <div
                key={line.id}
                className={`flex items-center gap-1.5 text-[11px] pl-5 select-none ${
                  isOk ? 'text-emerald-400/90 font-medium' : isErr ? 'text-red-400 font-medium' : 'text-zinc-500 italic'
                }`}
              >
                {isOk && <CheckCircle2 size={12} className="text-emerald-400" />}
                {isErr && <XCircle size={12} className="text-red-400" />}
                <span>{line.content}</span>
              </div>
            );
          }

          // stdout or normal info
          return (
            <div key={line.id} className="pl-5">
              {renderOutputLine(line.content, false)}
            </div>
          );
        })}

        {isRunning && (
          <div className="flex items-center gap-2 text-purple-400 animate-pulse pl-5 text-[12px] select-none">
            <RefreshCw size={12} className="animate-spin" />
            <span>Executing command...</span>
          </div>
        )}

        <div ref={consoleEndRef} />
      </div>

      {/* Dedicated Command Prompt Input Bar */}
      <div
        className="flex shrink-0 items-center gap-2 border-t border-white/[0.08] bg-[#111116] px-3 py-2 cursor-default"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.focus();
        }}
      >
        <span className="text-purple-400 select-none font-bold text-[14px]">❯</span>
        <span className="text-emerald-400 select-none text-[12px] font-semibold">vortex:~$</span>

        <div className="flex flex-1 items-center rounded-lg border border-white/[0.12] bg-black/50 px-2.5 py-1 focus-within:border-purple-500/70 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="Type command (e.g. ls, cargo check, git status)..."
            className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none text-[13px] font-mono select-text cursor-text"
          />
        </div>

        <button
          onClick={() => handleRunCommand()}
          disabled={!inputVal.trim()}
          className="flex h-7 items-center gap-1 rounded-md px-3 text-[11px] font-medium text-white transition-all disabled:opacity-40 select-none shadow-sm cursor-pointer"
          style={{ backgroundColor: accentColor }}
        >
          <Play size={11} />
          <span>Run</span>
        </button>
      </div>
    </div>
  );
};
