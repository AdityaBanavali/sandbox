import React from 'react';
import { THEMES } from '../../services/themeService';
import type { ThemeId } from '../../types/editor';
import { Palette, Type, Sliders, Sparkles, Check } from 'lucide-react';
import { ApiKeyVault } from './ApiKeyVault';

interface SettingsViewProps {
  currentThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  minimapEnabled: boolean;
  onToggleMinimap: () => void;
  tabSize: number;
  onChangeTabSize: (size: number) => void;
  wordWrap: 'on' | 'off';
  onToggleWordWrap: () => void;
  accentColor: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentThemeId,
  onSelectTheme,
  fontSize,
  onChangeFontSize,
  minimapEnabled,
  onToggleMinimap,
  tabSize,
  onChangeTabSize,
  wordWrap,
  onToggleWordWrap,
  accentColor,
}) => {
  return (
    <div className="flex h-full flex-col select-none text-zinc-300">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          Settings & Preferences
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Themes section */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 mb-3">
            <Palette size={14} style={{ color: accentColor }} />
            <span>Theme Engine</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(THEMES) as ThemeId[]).map((themeKey) => {
              const theme = THEMES[themeKey];
              const isSelected = currentThemeId === themeKey;
              return (
                <button
                  key={themeKey}
                  onClick={() => onSelectTheme(themeKey)}
                  className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-purple-500/70 bg-purple-950/20 text-white shadow-sm'
                      : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/[0.12] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: theme.accent }}
                    />
                    <div>
                      <div className="text-xs font-medium text-zinc-200">{theme.name}</div>
                      <div className="text-[10px] text-zinc-500">
                        {theme.isDark ? 'Dark Palette' : 'Light Palette'}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} style={{ color: theme.accent }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor display preferences */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 mb-3">
            <Type size={14} style={{ color: accentColor }} />
            <span>Editor Typography & Display</span>
          </div>

          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
            {/* Font Size */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Font Size ({fontSize}px)</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="11"
                  max="18"
                  value={fontSize}
                  onChange={(e) => onChangeFontSize(Number(e.target.value))}
                  className="w-24 accent-purple-500"
                />
                <span className="font-mono text-zinc-300 w-6 text-right">{fontSize}</span>
              </div>
            </div>

            {/* Minimap toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
              <span className="text-zinc-400">Code Minimap</span>
              <button
                onClick={onToggleMinimap}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  minimapEnabled ? 'bg-purple-600' : 'bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                    minimapEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Tab Size */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
              <span className="text-zinc-400">Tab Size</span>
              <div className="flex gap-1">
                {[2, 4].map((size) => (
                  <button
                    key={size}
                    onClick={() => onChangeTabSize(size)}
                    className={`rounded px-2 py-0.5 text-xs font-mono transition-colors ${
                      tabSize === size
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-white/[0.05] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Word wrap */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
              <span className="text-zinc-400">Word Wrap</span>
              <button
                onClick={onToggleWordWrap}
                className={`rounded px-2.5 py-0.5 text-xs transition-colors ${
                  wordWrap === 'on'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'bg-white/[0.05] text-zinc-400 hover:text-white'
                }`}
              >
                {wordWrap === 'on' ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </div>

        {/* API Key Vault & Multi-Model Fallback Engine */}
        <ApiKeyVault accentColor={accentColor} />
      </div>
    </div>
  );
};
