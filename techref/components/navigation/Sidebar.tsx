"use client";

import React, { useState } from "react";

export interface NavItem {
  id: string;
  title: string;
  badge?: string;
  method?: string;
  category?: string;
}

export interface NavSection {
  title: string;
  badge?: string;
  items: NavItem[];
}

interface SidebarProps {
  activeSection: string;
  onSelectSection: (id: string) => void;
  sections: NavSection[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  sections,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className="w-64 shrink-0 border-r border-white/10 bg-[#060911] h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto p-4 text-xs font-mono select-none">
      <div className="space-y-6">
        {sections.map((section) => {
          const isCollapsed = Boolean(collapsed[section.title]);
          return (
            <div key={section.title} className="space-y-1.5">
              <div
                onClick={() => toggleGroup(section.title)}
                className="flex items-center justify-between text-slate-400 font-bold uppercase tracking-wider px-2 py-1.5 rounded cursor-pointer hover:text-white hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold">
                    {isCollapsed ? "▶" : "▼"}
                  </span>
                  <span>{section.title}</span>
                </div>
                {section.badge && (
                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] font-mono">
                    {section.badge}
                  </span>
                )}
              </div>

              {!isCollapsed && (
                <div className="ml-2.5 pl-2.5 border-l border-white/10 space-y-1 mt-1">
                  {section.items.map((item) => {
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectSection(item.id)}
                        className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          isActive
                            ? "bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]"
                            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {item.method && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                item.method === "GET"
                                  ? "text-cyan-400 bg-cyan-950/60"
                                  : item.method === "POST"
                                  ? "text-emerald-400 bg-emerald-950/60"
                                  : item.method === "DELETE"
                                  ? "text-rose-400 bg-rose-950/60"
                                  : "text-amber-400 bg-amber-950/60"
                              }`}
                            >
                              {item.method}
                            </span>
                          )}
                          <span className="truncate">{item.title}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[9px] text-slate-500 font-mono ml-1">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
