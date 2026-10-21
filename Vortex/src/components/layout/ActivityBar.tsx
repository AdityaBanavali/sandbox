import React from 'react';
import {
  Files,
  Search,
  GitBranch,
  Blocks,
  Sparkles,
  Settings2,
} from 'lucide-react';

export type ActivityTab = 'files' | 'search' | 'git' | 'chat' | 'extensions' | 'settings';

interface ActivityBarProps {
  activeTab: ActivityTab;
  isSidebarOpen: boolean;
  onSelectTab: (tab: ActivityTab) => void;
  gitChangedCount?: number;
  accentColor: string;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  isSidebarOpen,
  onSelectTab,
  gitChangedCount = 0,
  accentColor,
}) => {
  const topItems: { id: ActivityTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'files', label: 'Explorer (Ctrl+Shift+E)', icon: <Files size={19} /> },
    { id: 'search', label: 'Global Search (Ctrl+Shift+F)', icon: <Search size={19} /> },
    { id: 'git', label: 'Source Control (Ctrl+Shift+G)', icon: <GitBranch size={19} />, badge: gitChangedCount },
    { id: 'chat', label: 'Vortex AI Copilot', icon: <Sparkles size={19} /> },
    { id: 'extensions', label: 'Extensions & Plugins', icon: <Blocks size={19} /> },
  ];

  return (
    <div
      className="z-30 flex w-[52px] shrink-0 flex-col items-center justify-between border-r border-white/[0.06] bg-[#09090b] py-3 select-none"
      style={{ backgroundColor: 'var(--vortex-activity-bg, #09090b)' }}
    >
      <div className="flex flex-col items-center gap-1.5">
        {topItems.map((item) => {
          const isActive = isSidebarOpen && activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={item.label}
              className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all"
            >
              {/* Active bar indicator on the left edge */}
              {isActive && (
                <span
                  className="absolute -left-[6px] h-6 w-[3px] rounded-r-full transition-all"
                  style={{ backgroundColor: accentColor }}
                />
              )}

              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                }`}
              >
                {item.icon}
              </span>

              {/* Badge for modified files */}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="absolute bottom-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow"
                  style={{ backgroundColor: accentColor }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={() => onSelectTab('settings')}
          title="Settings"
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all"
        >
          {isSidebarOpen && activeTab === 'settings' && (
            <span
              className="absolute -left-[6px] h-6 w-[3px] rounded-r-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              isSidebarOpen && activeTab === 'settings'
                ? 'bg-white/[0.08] text-white'
                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
            }`}
          >
            <Settings2 size={19} />
          </span>
        </button>
      </div>
    </div>
  );
};
