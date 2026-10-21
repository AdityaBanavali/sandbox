import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { BreakdownCards } from "./components/BreakdownCards";
import { Navbar } from "./components/Navbar";
import { PresetDemos } from "./components/PresetDemos";
import { SummaryHeader } from "./components/SummaryHeader";
import { TrustGauge } from "./components/TrustGauge";
import { UploadPanel } from "./components/UploadPanel";
import { Visualizer } from "./components/Visualizer";
import { useFixtures } from "./hooks/useFixtures";
import { useVerify } from "./hooks/useVerify";
import { DemoFixture } from "./types";

export const App: React.FC = () => {
  const { result, loading, error, activeStep, submitVerification, setDirectResult, reset } = useVerify();
  const { getPresetFixture } = useFixtures();
  const [activeFixtureId, setActiveFixtureId] = useState<string | null>(null);

  const handleSelectFixture = (fixture: DemoFixture) => {
    setActiveFixtureId(fixture.id);
    setDirectResult(fixture.result);
  };

  const handleVerifySubmit = (beforeFile: File, afterFile: File, issueType: any) => {
    setActiveFixtureId(null);
    submitVerification(beforeFile, afterFile, issueType);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* ONE-CLICK PRESET DEMO BUTTONS */}
        <PresetDemos
          onSelectFixture={handleSelectFixture}
          getPresetFixture={getPresetFixture}
          activeFixtureId={activeFixtureId}
          disabled={loading}
        />

        {/* UPLOAD PANEL */}
        <UploadPanel
          onVerify={handleVerifySubmit}
          loading={loading}
          activeStep={activeStep}
        />

        {/* ERROR STATE BANNER WITH RETRY */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5 text-xs sm:text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-rose-900">Verification Request Failed</span>
                <span>{error}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Dismiss & Retry
            </button>
          </div>
        )}

        {/* VERIFICATION REPORT RESULTS */}
        {result && (
          <section className="space-y-6 animate-fadeIn" aria-label="Verification audit results">
            <SummaryHeader result={result} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* VISUAL EVIDENCE VIEWER (2 Cols) */}
              <div className="lg:col-span-2">
                <Visualizer
                  beforeB64={result.before_image_b64}
                  afterB64={result.after_image_b64}
                  alignedAfterB64={result.aligned_after_image_b64}
                  diffHeatmapB64={result.diff_heatmap_b64}
                />
              </div>

              {/* COMPOSITE TRUST GAUGE (1 Col) */}
              <div className="lg:col-span-1">
                <TrustGauge
                  score={result.trust_score}
                  status={result.status}
                  breakdown={result.breakdown}
                />
              </div>
            </div>

            {/* THREE LAYER BREAKDOWN CARDS */}
            <BreakdownCards
              metadata={result.metadata}
              vision={result.vision}
              audit={result.audit}
            />
          </section>
        )}

        {/* EMPTY STATE PLACEHOLDER */}
        {!result && !loading && !error && (
          <div className="p-8 sm:p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-navy-50 text-navy-800 border border-navy-200/60 flex items-center justify-center mb-4 shadow-inner">
              <FileCheck2 className="w-7 h-7 text-saffron" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-navy-900">
              Awaiting Work Submission for Verification
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mt-1.5 leading-relaxed">
              Upload matching BEFORE and AFTER repair photographs above or click one of the
              evaluation presets to preview real-time automated fraud detection and quality auditing.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mt-8 text-left">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-wider block">
                  Layer 1: Metadata
                </span>
                <span className="text-xs font-semibold text-slate-800 block mt-1">
                  GPS &amp; EXIF Anti-Spoof
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Haversine geodetic distance &amp; perceptual re-upload hashing.
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block">
                  Layer 2: Vision
                </span>
                <span className="text-xs font-semibold text-slate-800 block mt-1">
                  OpenCV Registration
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  ORB homography perspective alignment &amp; surface roughness drop.
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-extrabold text-saffron-dark uppercase tracking-wider block">
                  Layer 3: AI Audit
                </span>
                <span className="text-xs font-semibold text-slate-800 block mt-1">
                  Gemini Engineering Review
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  BBMP municipal standards &amp; material quality verification.
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 BBMP CivicFix AI. Municipal Works Verification Division.</span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Automated Multi-Layer Fraud Prevention System
          </span>
        </div>
      </footer>
    </div>
  );
};
export default App;
