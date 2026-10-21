import React, { useState } from 'react';
import {
  GitBranch,
  AlertCircle,
  AlertTriangle,
  PanelBottom,
  Columns2,
  Rows2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { CursorPosition, EditorDiagnostics, SplitDirection } from '../../types/editor';
import { getLanguageDisplayName } from '../../services/languageService';

interface StatusBarProps {
  gitBranch: string;
  isGitClean: boolean;
  gitAhead?: number;
  gitBehind?: number;
  onOpenBranchManager?: () => void;
  diagnostics: EditorDiagnostics;
  currentLanguage: string;
  cursorPos: CursorPosition;
  encoding?: string;
  isBottomPanelOpen: boolean;
  onToggleBottomPanel: () => void;
  isSplit: boolean;
  splitDirection: SplitDirection;
  onToggleSplit: () => void;
  onSelectLanguage: (lang: string) => void;
  accentColor: string;
}

const COMMON_LANGUAGES = [
  { id: 'typescript', name: 'TypeScript' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'rust', name: 'Rust' },
  { id: 'json', name: 'JSON' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'markdown', name: 'Markdown' },
  { id: 'python', name: 'Python' },
  { id: 'shell', name: 'Shell Script' },
  { id: 'ini', name: 'Config/TOML' },
];

export const StatusBar: React.FC<StatusBarProps> = ({
  gitBranch,
  isGitClean,
  gitAhead = 0,
  gitBehind = 0,
  onOpenBranchManager,
  diagnostics,
  currentLanguage,
  cursorPos,
  encoding = 'UTF-8',
  isBottomPanelOpen,
  onToggleBottomPanel,
  isSplit,
  splitDirection,
  onToggleSplit,
  onSelectLanguage,
  accentColor,
}) => {
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <div
      className="relative z-20 flex h-[26px] shrink-0 items-center justify-between border-t border-white/[0.06] bg-[#0b0b0e] px-2 text-[11px] text-zinc-400 select-none"
      style={{ backgroundColor: 'var(--vortex-statusbar-bg, #0b0b0e)' }}
    >
      {/* Left side items */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Git branch button */}
        <button
          onClick={onOpenBranchManager}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-white/[0.07] hover:text-zinc-200 transition-colors cursor-pointer"
          title={`Git branch: ${gitBranch} (Click to switch or create branches)`}
        >
          <GitBranch size={12} style={{ color: accentColor }} />
          <span className="font-medium text-zinc-300">{gitBranch}</span>
          {!isGitClean && <span className="text-[10px] text-amber-400 font-bold">*</span>}
          {(gitAhead > 0 || gitBehind > 0) && (
            <span className="font-mono text-[10px] text-zinc-400 ml-0.5">
              {gitAhead > 0 ? `↑${gitAhead}` : ''}
              {gitBehind > 0 ? `↓${gitBehind}` : ''}
            </span>
          )}
        </button>

        {/* Problems/Diagnostics counter */}
        <div className="flex items-center gap-2 pl-1">
          <div
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
              diagnostics.errors > 0 ? 'text-red-400 font-medium' : 'text-zinc-500'
            }`}
            title={`${diagnostics.errors} Errors`}
          >
            <AlertCircle size={11} className={diagnostics.errors > 0 ? 'text-red-400' : 'text-zinc-600'} />
            <span>{diagnostics.errors}</span>
          </div>

          <div
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
              diagnostics.warnings > 0 ? 'text-amber-400 font-medium' : 'text-zinc-500'
            }`}
            title={`${diagnostics.warnings} Warnings`}
          >
            <AlertTriangle size={11} className={diagnostics.warnings > 0 ? 'text-amber-400' : 'text-zinc-600'} />
            <span>{diagnostics.warnings}</span>
          </div>

          {diagnostics.errors === 0 && diagnostics.warnings === 0 && (
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-400/80">
              <CheckCircle2 size={10} />
              <span>No problems</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side items */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Cursor coordinates */}
        <div className="rounded px-2 py-0.5 font-mono text-[11px] text-zinc-300">
          Ln {cursorPos.line}, Col {cursorPos.column}
        </div>

        {/* Spaces/Tabs */}
        <span className="hidden sm:inline rounded px-1.5 py-0.5 text-zinc-400">Spaces: 2</span>

        {/* Encoding */}
        <span className="hidden sm:inline rounded px-1.5 py-0.5 text-zinc-400">{encoding}</span>

        {/* Language selector popover button */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-1 rounded px-2 py-0.5 font-medium hover:bg-white/[0.07] hover:text-zinc-200 transition-colors"
            style={{ color: showLangMenu ? accentColor : undefined }}
          >
            {getLanguageDisplayName(currentLanguage)}
          </button>

          {showLangMenu && (
            <div
              className="absolute bottom-7 right-0 w-44 rounded-lg border border-white/[0.1] bg-[#141419] p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
              style={{ backgroundColor: 'var(--vortex-card-bg, #141419)' }}
            >
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                Select Language Mode
              </div>
              <div className="max-h-56 overflow-y-auto">
                {COMMON_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      onSelectLanguage(lang.id);
                      setShowLangMenu(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
                      currentLanguage === lang.id
                        ? 'bg-white/[0.1] font-semibold text-white'
                        : 'text-zinc-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <span>{lang.name}</span>
                    {currentLanguage === lang.id && (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Split editor toggle */}
        <button
          onClick={onToggleSplit}
          title={isSplit ? 'Close Split View' : 'Split Editor Right'}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/[0.07] hover:text-zinc-200 transition-colors"
        >
          {isSplit ? (
            splitDirection === 'horizontal' ? <Columns2 size={12} className="text-purple-400" /> : <Rows2 size={12} className="text-purple-400" />
          ) : (
            <Columns2 size={12} />
          )}
          <span className="hidden md:inline">{isSplit ? 'Split On' : 'Split'}</span>
        </button>

        {/* Bottom panel toggle */}
        <button
          onClick={onToggleBottomPanel}
          title={isBottomPanelOpen ? 'Hide Terminal / Bottom Panel' : 'Show Terminal / Bottom Panel (Ctrl+`)'}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/[0.07] hover:text-zinc-200 transition-colors"
        >
          <PanelBottom size={12} className={isBottomPanelOpen ? 'text-zinc-200' : 'text-zinc-500'} />
          <span className="hidden md:inline">{isBottomPanelOpen ? 'Hide Panel' : 'Panel'}</span>
        </button>

        {/* AI Engine badge */}
        <div
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, #6366f1 100%)` }}
        >
          <Sparkles size={10} />
          <span>Vortex AI</span>
        </div>
      </div>
    </div>
  );
};
