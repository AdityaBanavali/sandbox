import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Download,
  Share2,
  Settings,
  ChevronDown,
  Check,
  Image,
  FileCode,
  FileSpreadsheet,
  Layers,
  ExternalLink,
  Circle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Header({
  samples,
  selectedSampleId,
  onSelectSample,
  onExportPng,
  onExportSvg,
  onShareLink,
  onOpenSettings,
  isBackendConnected,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const exportRef = useRef(null);
  const samplesRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setExportOpen(false);
      }
      if (samplesRef.current && !samplesRef.current.contains(event.target)) {
        setSamplesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShareClick = () => {
    onShareLink();
    setCopiedShare(true);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.1, x: 0.8 },
      colors: ['#6366f1', '#06b6d4', '#10b981'],
    });
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const currentSample = samples.find((s) => s.id === selectedSampleId);

  return (
    <header className="h-14 bg-panel/95 backdrop-blur-md border-b border-border-subtle px-4 flex items-center justify-between text-slate-100 z-30 shrink-0">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-panel rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                CodeVisualizer
              </span>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AI MVP
              </span>
            </div>
          </div>
        </div>

        {/* Backend Status indicator */}
        <div className="hidden lg:flex items-center gap-1.5 pl-4 border-l border-slate-800 text-[11px] text-slate-400">
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendConnected ? 'bg-emerald-400 shadow-glow-emerald' : 'bg-amber-400'
            }`}
          />
          <span>{isBackendConnected ? 'Backend API Online' : 'Connecting to API...'}</span>
        </div>
      </div>

      {/* Middle: Sample Selector */}
      <div className="relative" ref={samplesRef}>
        <button
          onClick={() => setSamplesOpen(!samplesOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card hover:bg-card-hover border border-border-subtle text-xs font-medium text-slate-200 transition"
        >
          <span className="text-slate-400 hidden sm:inline">Preset:</span>
          <span className="text-indigo-300 font-semibold truncate max-w-[150px] sm:max-w-[220px]">
            {currentSample ? currentSample.title : 'Select Sample'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        {samplesOpen && (
          <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-72 rounded-2xl bg-panel border border-border-subtle shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pre-loaded Architecture Snippets
            </div>
            <div className="mt-1 space-y-1">
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    onSelectSample(sample);
                    setSamplesOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl transition flex flex-col gap-0.5 ${
                    sample.id === selectedSampleId
                      ? 'bg-indigo-600/20 text-white border border-indigo-500/40'
                      : 'hover:bg-card text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{sample.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {sample.language}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 line-clamp-1">
                    {sample.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Export, Share, Settings */}
      <div className="flex items-center gap-2">
        {/* Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-card-hover border border-border-subtle text-xs font-semibold text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-panel border border-border-subtle shadow-2xl p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportPng();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                <Image className="w-4 h-4 text-emerald-400" />
                <div className="text-left">
                  <div className="font-medium">Export as PNG</div>
                  <div className="text-[10px] text-slate-500">High-res 2x image</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setExportOpen(false);
                  onExportSvg();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                <FileCode className="w-4 h-4 text-cyan-400" />
                <div className="text-left">
                  <div className="font-medium">Export as SVG</div>
                  <div className="text-[10px] text-slate-500">Scalable vector graphic</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Share Link Button */}
        <button
          onClick={handleShareClick}
          title="Copy shareable link with encoded code"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-card-hover border border-border-subtle text-xs font-semibold text-slate-200 transition active:scale-95"
        >
          {copiedShare ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Share</span>
            </>
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Configure AI model & API keys"
          className="p-2 rounded-xl bg-card hover:bg-card-hover border border-border-subtle text-slate-400 hover:text-white transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
