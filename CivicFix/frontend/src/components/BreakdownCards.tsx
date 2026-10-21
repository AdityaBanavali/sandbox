import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  FileSearch,
  Hash,
  MapPin,
  Sparkles,
  XCircle,
} from "lucide-react";
import { AuditResult, MetadataResult, VisionResult } from "../types";

interface BreakdownCardsProps {
  metadata: MetadataResult;
  vision: VisionResult;
  audit: AuditResult;
}

export const BreakdownCards: React.FC<BreakdownCardsProps> = ({ metadata, vision, audit }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
      {/* 1. METADATA & GPS ANTI-SPOOFING CARD */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Layer 1: Geo & Metadata
                </h4>
                <p className="text-[11px] text-slate-400">Anti-Spoofing Verification</p>
              </div>
            </div>
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                metadata.score >= 80
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : metadata.score >= 50
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {metadata.score.toFixed(0)} / 100
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Geodetic Distance & Threshold Indicator */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                <Compass className="w-3.5 h-3.5 text-slate-400" />
                GPS Separation
              </span>
              <div className="text-right">
                <span className="font-bold text-slate-900 block">
                  {metadata.distance_m !== null ? `${metadata.distance_m.toFixed(1)} m` : "Unavailable"}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    metadata.location_mismatch
                      ? "text-rose-600 font-bold"
                      : "text-emerald-600"
                  }`}
                >
                  {metadata.location_mismatch ? "Exceeds 25m limit!" : "Within 25m tolerance"}
                </span>
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold">BEFORE GPS</span>
                <span className="font-mono text-slate-700 font-medium">
                  {metadata.before_gps
                    ? `${metadata.before_gps.lat.toFixed(4)}, ${metadata.before_gps.lon.toFixed(4)}`
                    : "No EXIF GPS"}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold">AFTER GPS</span>
                <span className="font-mono text-slate-700 font-medium">
                  {metadata.after_gps
                    ? `${metadata.after_gps.lat.toFixed(4)}, ${metadata.after_gps.lon.toFixed(4)}`
                    : "No EXIF GPS"}
                </span>
              </div>
            </div>

            {/* Timestamp Sequence Check */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Time Sequence
              </span>
              <span className="flex items-center gap-1 font-semibold">
                {metadata.timestamp_valid === true ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Valid Chronology
                  </span>
                ) : metadata.timestamp_valid === false ? (
                  <span className="text-rose-700 flex items-center gap-1 font-bold">
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    Inverted Order
                  </span>
                ) : (
                  <span className="text-slate-500">EXIF Stripped / Missing</span>
                )}
              </span>
            </div>

            {/* Perceptual Hash Similarity */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                pHash Distance
              </span>
              <div className="text-right">
                <span className="font-mono font-bold text-slate-800">
                  {metadata.phash_distance !== null ? metadata.phash_distance : "N/A"}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {metadata.is_duplicate_or_reupload
                    ? "Duplicate Detected!"
                    : "Unique captures"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Flag chips */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <span className="text-[10px] text-slate-400 block font-semibold mb-1.5 uppercase">
            Flags & Signals ({metadata.flags.length})
          </span>
          {metadata.flags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {metadata.flags.map((flag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                >
                  {flag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Clean metadata checks (no spoof flags)
            </span>
          )}
        </div>
      </div>

      {/* 2. OPENCV VISION REGISTRATION CARD */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Layer 2: Vision & Surface
                </h4>
                <p className="text-[11px] text-slate-400">Homography & Roughness</p>
              </div>
            </div>
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                vision.score >= 80
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : vision.score >= 50
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {vision.score.toFixed(0)} / 100
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Homography Alignment Status */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600 font-medium">Homography Alignment</span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  vision.alignment_succeeded ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {vision.alignment_succeeded ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Succeeded (RANSAC)
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-500" />
                    Failed to Align
                  </>
                )}
              </span>
            </div>

            {/* Inliers & Feature Matches */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">ORB Keypoints & Inliers</span>
              <div className="text-right">
                <span className="font-bold text-slate-900 font-mono">
                  {vision.inliers} inliers
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {vision.good_matches} good matches ({vision.keypoints_before} &rarr; {vision.keypoints_after} kps)
                </span>
              </div>
            </div>

            {/* Change Magnitude Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                <span>Pixel Difference Magnitude</span>
                <span className="font-mono text-slate-900">
                  {(vision.change_magnitude * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, vision.change_magnitude * 100)}%` }}
                  className={`h-full rounded-full transition-all ${
                    vision.change_magnitude >= 0.05 && vision.change_magnitude <= 0.35
                      ? "bg-emerald-500"
                      : vision.change_magnitude > 0.6
                      ? "bg-rose-500"
                      : "bg-amber-500"
                  }`}
                />
              </div>
            </div>

            {/* Surface Roughness Drop (Laplacian Variance) */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-700 font-bold">Surface Roughness Drop</span>
                <span
                  className={`font-extrabold ${
                    vision.roughness_drop_ratio && vision.roughness_drop_ratio > 0.2
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {vision.roughness_drop_ratio !== null
                    ? `${(vision.roughness_drop_ratio * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                <span>Before var: {vision.roughness_before ?? "-"}</span>
                <span>After var: {vision.roughness_after ?? "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Flag chips */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <span className="text-[10px] text-slate-400 block font-semibold mb-1.5 uppercase">
            Vision Flags ({vision.flags.length})
          </span>
          {vision.flags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {vision.flags.map((flag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                >
                  {flag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Optimal surface smoothing & registration
            </span>
          )}
        </div>
      </div>

      {/* 3. GEMINI MULTIMODAL AUDIT CARD */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-saffron-50 text-saffron-dark border border-saffron/30">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Layer 3: Gemini Multimodal Audit
                </h4>
                <p className="text-[11px] text-slate-400">Qualitative Engineering Review</p>
              </div>
            </div>
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                audit.score >= 80
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : audit.score >= 50
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {audit.score.toFixed(0)} / 100
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Verdict Pill & Confidence Meter */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">VERDICT</span>
                <span
                  className={`font-extrabold text-xs inline-block mt-0.5 ${
                    audit.verdict === "RESOLVED"
                      ? "text-emerald-700"
                      : audit.verdict === "PARTIALLY_RESOLVED"
                      ? "text-amber-700"
                      : "text-rose-700"
                  }`}
                >
                  {audit.verdict.replace("_", " ")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-semibold">CONFIDENCE</span>
                <span className="font-bold font-mono text-slate-900">
                  {(audit.confidence_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Reinspection Banner */}
            {audit.requires_field_reinspection && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[11px]">Requires Field Reinspection</span>
                  <span className="text-[10px] text-amber-800">
                    Confidence threshold &lt; 0.7 or repair quality flagged for physical verification.
                  </span>
                </div>
              </div>
            )}

            {/* Observations */}
            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">DEFECT BEFORE:</span>
                <p className="text-slate-700 font-medium line-clamp-2">{audit.defect_detected_before}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">STATUS AFTER:</span>
                <p className="text-slate-700 font-medium line-clamp-2">{audit.status_observed_after}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">QUALITY NOTES:</span>
                <p className="text-slate-600 italic line-clamp-2 font-serif">{audit.repair_quality_notes}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Red Flags & Fallback Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">
              Red Flags ({audit.red_flags.length})
            </span>
            {audit.source === "fallback" && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                Fallback: AI Unavailable
              </span>
            )}
          </div>

          {audit.red_flags.length > 0 ? (
            <div className="space-y-1">
              {audit.red_flags.map((flag, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-1.5 text-[11px] text-rose-700 font-medium bg-rose-50/70 p-1.5 rounded border border-rose-100"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              No red flags or spoofing indicators observed
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
