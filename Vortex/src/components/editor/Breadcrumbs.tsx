import React from 'react';
import { ChevronRight, FolderClosed, FileCode2, Home } from 'lucide-react';

interface BreadcrumbsProps {
  filePath?: string;
  onNavigatePath?: (path: string) => void;
  accentColor: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ filePath, onNavigatePath }) => {
  if (!filePath) {
    return (
      <div className="flex h-7 shrink-0 items-center px-4 text-[11.5px] text-zinc-600 border-b border-white/[0.04] bg-[#0d0d11]">
        <span>No file selected</span>
      </div>
    );
  }

  const segments = filePath.split('/').filter(Boolean);

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-1.5 border-b border-white/[0.04] bg-[#0c0c10] px-3 text-[11.5px] text-zinc-400 select-none overflow-x-auto"
      style={{ backgroundColor: 'var(--vortex-breadcrumb-bg, #0c0c10)' }}
    >
      <div className="flex items-center gap-1 text-zinc-400">
        <Home size={12} className="text-zinc-400" />
        <span>vortex</span>
      </div>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const subPath = segments.slice(0, index + 1).join('/');

        return (
          <React.Fragment key={subPath}>
            <ChevronRight size={11} className="text-zinc-600 shrink-0" />
            <button
              onClick={() => onNavigatePath?.(subPath)}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                isLast
                  ? 'font-medium text-zinc-200 hover:bg-white/[0.06]'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
              }`}
            >
              {isLast ? (
                <FileCode2 size={12} className="text-purple-400 shrink-0" />
              ) : (
                <FolderClosed size={12} className="text-zinc-500 shrink-0" />
              )}
              <span className="truncate">{segment}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};
