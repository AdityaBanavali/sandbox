import React, { useState } from 'react';
import { Key, Eye, EyeOff, Check, X, Shield, RefreshCw, Zap } from 'lucide-react';
import { AiService, FALLBACK_MODELS } from '../../services/aiService';

interface ApiKeyVaultProps {
  accentColor: string;
}

export const ApiKeyVault: React.FC<ApiKeyVaultProps> = ({ accentColor }) => {
  const [apiKey, setApiKey] = useState(AiService.getCustomKey());
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const hasCustom = Boolean(apiKey.trim());

  const handleSave = () => {
    AiService.setCustomKey(apiKey);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleClear = () => {
    AiService.clearCustomKey();
    setApiKey('');
    setTestResult(null);
  };

  const handleTest = async () => {
    const keyToTest = apiKey.trim() || AiService.getActiveApiKey();
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await AiService.testApiKey(keyToTest);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: `Failed: ${err?.message || err}` });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
        <Shield size={14} style={{ color: accentColor }} />
        <span>Custom API Key Vault & Model Fallback</span>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 text-xs space-y-3">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Vault Status:</span>
          {hasCustom ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Check size={10} /> Custom Key Active
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
              <Zap size={10} /> Default Embedded Key
            </span>
          )}
        </div>

        {/* Input line with eye toggle */}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-400">Google Gemini API Key</label>
          <div className="flex items-center rounded-lg border border-white/[0.1] bg-black/50 px-2.5 py-1.5 focus-within:border-purple-500/60 transition-colors">
            <Key size={13} className="text-zinc-500 mr-2 shrink-0" />
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Gemini API key (AIza...)"
              className="flex-1 bg-transparent text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 ml-1"
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-medium text-white shadow transition-all"
            style={{ backgroundColor: accentColor }}
          >
            {savedSuccess ? <Check size={12} /> : null}
            <span>{savedSuccess ? 'Saved!' : 'Save Key'}</span>
          </button>

          <button
            onClick={handleTest}
            disabled={isTesting}
            className="flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/[0.08] transition-all disabled:opacity-50"
          >
            {isTesting && <RefreshCw size={11} className="animate-spin" />}
            <span>Test Connection</span>
          </button>

          {hasCustom && (
            <button
              onClick={handleClear}
              className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors ml-auto"
            >
              Reset
            </button>
          )}
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`flex items-start gap-1.5 rounded-lg p-2 text-[11px] ${
              testResult.success
                ? 'bg-emerald-950/30 border border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/30 border border-red-500/30 text-red-300'
            }`}
          >
            {testResult.success ? (
              <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" />
            ) : (
              <X size={12} className="mt-0.5 shrink-0 text-red-400" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Fallback Engine Info */}
        <div className="border-t border-white/[0.06] pt-2 space-y-1">
          <div className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">
            Multi-Model Fallback Rotation Chain:
          </div>
          <div className="space-y-1 text-[11px] text-zinc-500">
            {FALLBACK_MODELS.map((m, idx) => (
              <div key={m.id} className="flex items-center gap-1.5">
                <span className="font-mono text-purple-400 font-bold">{idx + 1}.</span>
                <span className="text-zinc-300 font-medium">{m.id}</span>
                <span className="text-[10px] text-zinc-500">({m.name.split('(')[1]?.replace(')', '') || 'Active'})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
