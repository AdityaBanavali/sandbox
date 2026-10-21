import React, { useState } from 'react';
import { Copy, Check, ArrowDownToLine, FilePlus2 } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
  onInsertAtCursor?: (code: string) => void;
  onCreateNewFile?: (code: string, language: string) => void;
  accentColor: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  code,
  onInsertAtCursor,
  onCreateNewFile,
  accentColor,
}) => {
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleInsert = () => {
    if (onInsertAtCursor) {
      onInsertAtCursor(code);
      setInserted(true);
      setTimeout(() => setInserted(false), 2000);
    }
  };

  const handleNewFile = () => {
    if (onCreateNewFile) {
      onCreateNewFile(code, language);
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0c0c10] shadow-md">
      {/* Code block header bar with actions */}
      <div className="flex h-8 items-center justify-between border-b border-white/[0.07] bg-[#121217] px-3 select-none">
        <span className="font-mono text-[11px] font-semibold text-purple-400 uppercase tracking-wide">
          {language || 'code'}
        </span>

        <div className="flex items-center gap-1.5">
          {/* Insert at cursor button */}
          {onInsertAtCursor && (
            <button
              onClick={handleInsert}
              title="Inject code directly at current cursor position in active editor"
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                inserted
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'
              }`}
            >
              {inserted ? <Check size={11} /> : <ArrowDownToLine size={11} />}
              <span>{inserted ? 'Inserted!' : 'Insert at Cursor'}</span>
            </button>
          )}

          {/* New file with code button */}
          {onCreateNewFile && (
            <button
              onClick={handleNewFile}
              title="Create new document tab with this code"
              className="flex items-center gap-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors"
            >
              <FilePlus2 size={11} />
              <span>New File</span>
            </button>
          )}

          {/* Copy code button */}
          <button
            onClick={handleCopy}
            title="Copy code to clipboard"
            className="flex items-center gap-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-zinc-200 select-text">
        <pre className="m-0 whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
