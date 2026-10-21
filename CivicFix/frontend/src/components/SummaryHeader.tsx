import React from "react";
import { AlertCircle, Clock, Download, FileCheck, Shield } from "lucide-react";
import { VerifyResponse } from "../types";

interface SummaryHeaderProps {
  result: VerifyResponse;
}

export const SummaryHeader: React.FC<SummaryHeaderProps> = ({ result }) => {
  const handleDownload = () => {
    const jsonStr = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `civicfix-audit-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-navy-900 text-saffron">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-navy-900">
                Official Verification Audit Certificate
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase tracking-wider border border-slate-200">
                BBMP Engine v0.1
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Processing time: <strong className="text-slate-800">{result.processing_ms} ms</strong>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1 font-medium">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                Resolution Verdict: <strong className="text-slate-800">{result.status}</strong>
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="px-4 py-2 rounded-lg border border-slate-300 hover:border-navy-800 bg-slate-50 hover:bg-white text-navy-900 text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
        >
          <Download className="w-4 h-4 text-saffron" />
          Download Audit Report (JSON)
        </button>
      </div>

      {/* OPERATIONAL WARNINGS */}
      {result.warnings.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
          {result.warnings.map((warning, index) => (
            <div
              key={index}
              className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
