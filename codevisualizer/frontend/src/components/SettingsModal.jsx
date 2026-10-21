import React, { useState } from 'react';
import { X, Key, Cpu, Sparkles, Check, Info } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, config, onSaveConfig }) {
  const [provider, setProvider] = useState(config.provider || 'gemini');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveConfig({ provider, apiKey: apiKey.trim() });
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-panel border border-border-subtle shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">AI Model & Engine Settings</h2>
            <p className="text-xs text-slate-400">Configure your LLM provider or offline parser</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Parser Engine / AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                  provider === 'gemini'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium ring-1 ring-indigo-500'
                    : 'bg-card border-border-subtle text-slate-400 hover:border-slate-600'
                }`}
              >
                <Sparkles className="w-4 h-4 mb-1 text-indigo-400" />
                <span className="text-xs">Gemini 2.0</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                  provider === 'openai'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium ring-1 ring-indigo-500'
                    : 'bg-card border-border-subtle text-slate-400 hover:border-slate-600'
                }`}
              >
                <Cpu className="w-4 h-4 mb-1 text-emerald-400" />
                <span className="text-xs">GPT-4o Mini</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('fallback')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                  provider === 'fallback'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium ring-1 ring-indigo-500'
                    : 'bg-card border-border-subtle text-slate-400 hover:border-slate-600'
                }`}
              >
                <Key className="w-4 h-4 mb-1 text-amber-400" />
                <span className="text-xs">Offline AST</span>
              </button>
            </div>
          </div>

          {provider !== 'fallback' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {provider === 'gemini' ? 'Google Gemini API Key' : 'OpenAI API Key'}
                </label>
                <span className="text-[10px] text-slate-500">Stored locally in browser</span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border-subtle text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              {provider === 'fallback'
                ? 'Offline mode analyzes AST nodes, function calls, and API routes locally with zero external API calls.'
                : 'If no API key is entered, CodeVisualizer automatically runs the built-in AST parser so diagrams still render instantly!'}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95"
            >
              {savedToast ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
