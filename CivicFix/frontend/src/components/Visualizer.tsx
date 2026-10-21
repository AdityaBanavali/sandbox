import React, { useEffect, useRef, useState } from "react";
import { Columns, Eye, Layers, Sliders, Sparkles } from "lucide-react";

interface VisualizerProps {
  beforeB64: string | null;
  afterB64: string | null;
  alignedAfterB64: string | null;
  diffHeatmapB64: string | null;
}

type TabType = "split" | "side-by-side" | "heatmap" | "aligned";

function formatImageSrc(b64: string | null): string {
  if (!b64) return "";
  if (b64.startsWith("data:")) return b64;
  // If base64 decoded starts with <svg
  if (b64.startsWith("PHN2")) return `data:image/svg+xml;base64,${b64}`;
  return `data:image/jpeg;base64,${b64}`;
}

export const Visualizer: React.FC<VisualizerProps> = ({
  beforeB64,
  afterB64,
  alignedAfterB64,
  diffHeatmapB64,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("split");
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0-100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const beforeSrc = formatImageSrc(beforeB64);
  const afterSrc = formatImageSrc(afterB64);
  const alignedSrc = formatImageSrc(alignedAfterB64);
  const heatmapSrc = formatImageSrc(diffHeatmapB64);

  // Fallback to active tab if selected tab becomes disabled
  useEffect(() => {
    if (activeTab === "aligned" && !alignedSrc) {
      setActiveTab("split");
    } else if (activeTab === "heatmap" && !heatmapSrc) {
      setActiveTab("split");
    }
  }, [alignedSrc, heatmapSrc, activeTab]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSliderFromEvent(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateSliderFromEvent(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const updateSliderFromEvent = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = Math.round((x / rect.width) * 100);
    setSliderPos(percentage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (activeTab !== "split") return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSliderPos((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSliderPos((prev) => Math.min(100, prev + 5));
    }
  };

  const tabs: { id: TabType; label: string; icon: any; available: boolean }[] = [
    { id: "split", label: "Split Slider", icon: Sliders, available: !!(beforeSrc && afterSrc) },
    { id: "side-by-side", label: "Side by Side", icon: Columns, available: !!(beforeSrc && afterSrc) },
    { id: "heatmap", label: "Diff Heatmap", icon: Sparkles, available: !!heatmapSrc },
    { id: "aligned", label: "Aligned Overlay", icon: Layers, available: !!alignedSrc },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5">
      {/* HEADER & TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-navy-900 flex items-center gap-2">
            <Eye className="w-4 h-4 text-saffron" />
            Visual Evidence Inspection
          </h3>
          <p className="text-xs text-slate-500">
            Compare camera perspective, homography warping, and localized surface differences
          </p>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto overflow-x-auto max-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={!tab.available}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  isCurrent
                    ? "bg-white text-navy-900 shadow-sm"
                    : tab.available
                    ? "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    : "text-slate-400 cursor-not-allowed opacity-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VISUALIZER VIEWPORTS */}
      <div className="relative w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center min-h-[340px] max-h-[560px]">
        {/* 1. SPLIT SLIDER VIEW */}
        {activeTab === "split" && (
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="slider"
            aria-label="Before/After comparison slider. Use arrow keys to adjust."
            aria-valuenow={sliderPos}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative w-full h-[380px] sm:h-[460px] select-none cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-saffron"
          >
            {/* AFTER IMAGE (Bottom Layer) */}
            <img
              src={afterSrc}
              alt="After resolution"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
            <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-white text-[11px] font-bold rounded pointer-events-none backdrop-blur-sm">
              AFTER (Claimed Fix)
            </div>

            {/* BEFORE IMAGE (Top Layer, clipped) */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              <img
                src={beforeSrc}
                alt="Before resolution"
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/70 text-white text-[11px] font-bold rounded backdrop-blur-sm">
                BEFORE (Complaint)
              </div>
            </div>

            {/* DRAGGABLE DIVIDER LINE */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="w-8 h-8 rounded-full bg-navy-900 border-2 border-white text-saffron flex items-center justify-center shadow-lg text-xs font-bold pointer-events-auto cursor-ew-resize">
                &#8596;
              </div>
            </div>
          </div>
        )}

        {/* 2. SIDE BY SIDE VIEW */}
        {activeTab === "side-by-side" && (
          <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full gap-2 p-2 sm:p-3">
            <div className="relative bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center h-64 sm:h-[420px]">
              <img src={beforeSrc} alt="Before complaint" className="max-h-full max-w-full object-contain" />
              <div className="absolute top-3 left-3 px-2 py-1 bg-black/75 text-white text-[11px] font-bold rounded">
                BEFORE (Complaint)
              </div>
            </div>
            <div className="relative bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center h-64 sm:h-[420px]">
              <img src={afterSrc} alt="After resolution" className="max-h-full max-w-full object-contain" />
              <div className="absolute top-3 left-3 px-2 py-1 bg-black/75 text-emerald-300 text-[11px] font-bold rounded">
                AFTER (Claimed Fix)
              </div>
            </div>
          </div>
        )}

        {/* 3. DIFF HEATMAP VIEW */}
        {activeTab === "heatmap" && heatmapSrc && (
          <div className="relative w-full h-[380px] sm:h-[460px] p-2 flex items-center justify-center">
            <img src={heatmapSrc} alt="OpenCV Surface Difference Heatmap" className="max-h-full max-w-full object-contain" />
            <div className="absolute bottom-3 left-3 px-2.5 py-1.5 bg-black/80 text-white text-xs rounded backdrop-blur-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
              <span className="font-semibold">JET Heatmap: Warm colors indicate structural change area</span>
            </div>
          </div>
        )}

        {/* 4. ALIGNED OVERLAY VIEW */}
        {activeTab === "aligned" && alignedSrc && (
          <div className="relative w-full h-[380px] sm:h-[460px] p-2 flex items-center justify-center">
            <img src={alignedSrc} alt="Homography Aligned After Photo" className="max-h-full max-w-full object-contain" />
            <div className="absolute bottom-3 left-3 px-2.5 py-1.5 bg-black/80 text-white text-xs rounded backdrop-blur-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
              <span className="font-semibold">Homography Warped onto BEFORE Perspective Frame</span>
            </div>
          </div>
        )}
      </div>

      {activeTab === "split" && (
        <p className="text-[11px] text-slate-500 text-center mt-2.5">
          Drag slider left/right or use keyboard <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300 text-[10px] font-mono">Left</kbd>/<kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300 text-[10px] font-mono">Right</kbd> arrow keys to compare registration
        </p>
      )}
    </div>
  );
};
