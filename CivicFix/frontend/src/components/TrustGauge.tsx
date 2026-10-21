import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { TrustBreakdown, TrustStatus } from "../types";

interface TrustGaugeProps {
  score: number;
  status: TrustStatus;
  breakdown: TrustBreakdown;
}

export const TrustGauge: React.FC<TrustGaugeProps> = ({ score, status, breakdown }) => {
  const [animatedScore, setAnimatedScore] = useState<number>(0);

  useEffect(() => {
    // Smooth initial animation to target score
    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Number((score * eased).toFixed(1)));

      if (progress < 1.0) {
        requestAnimationFrame(animate);
      } else {
        setAnimatedScore(score);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  // Status Badge Metadata
  const statusConfig = {
    APPROVED: {
      label: "Verified Fix (Approved)",
      icon: CheckCircle,
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-300",
      gaugeColor: "#10B981", // Emerald 500
      badgeRing: "ring-emerald-500/20",
    },
    NEEDS_REVIEW: {
      label: "Incomplete / Needs Review",
      icon: AlertTriangle,
      textColor: "text-amber-800",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-300",
      gaugeColor: "#F59E0B", // Amber 500
      badgeRing: "ring-amber-500/20",
    },
    REJECTED_FRAUD: {
      label: "Fraud Suspected (Rejected)",
      icon: ShieldAlert,
      textColor: "text-rose-700",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-300",
      gaugeColor: "#E11D48", // Rose 600
      badgeRing: "ring-rose-500/20",
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  // SVG Circular Gauge Calculations
  const radius = 68;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  // Segmented weighted contributions: (score / 100) * weight
  const metaContribution = Number(((breakdown.metadata / 100) * 30).toFixed(1));
  const visionContribution = Number(((breakdown.vision / 100) * 30).toFixed(1));
  const llmContribution = Number(((breakdown.llm / 100) * 40).toFixed(1));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col items-center justify-between">
      <div className="w-full text-center pb-3 border-b border-slate-100">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Composite Trust Score
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Automated Multi-Layer Synthesis</p>
      </div>

      {/* CIRCULAR RADIAL GAUGE */}
      <div className="relative my-4 flex items-center justify-center">
        <svg width="180" height="180" className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated score stroke */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke={statusConfig.gaugeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-300 ease-out"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            {animatedScore.toFixed(0)}
          </span>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            out of 100
          </span>
        </div>
      </div>

      {/* STATUS BADGE */}
      <div
        className={`w-full py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold ring-1 ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor} ${statusConfig.badgeRing}`}
      >
        <StatusIcon className="w-4 h-4 flex-shrink-0" />
        <span>{statusConfig.label}</span>
      </div>

      {/* WEIGHTED CONTRIBUTIONS BAR */}
      <div className="w-full mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-2">
          <span>Layer Contribution Breakdown</span>
          <span className="text-navy-900 font-bold">{score.toFixed(1)} pts</span>
        </div>

        {/* Stacked Bar */}
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${(metaContribution / 100) * 100}%` }}
            className="bg-sky-500 transition-all duration-500"
            title={`Metadata: ${metaContribution} / 30 pts`}
          />
          <div
            style={{ width: `${(visionContribution / 100) * 100}%` }}
            className="bg-indigo-500 transition-all duration-500"
            title={`Vision: ${visionContribution} / 30 pts`}
          />
          <div
            style={{ width: `${(llmContribution / 100) * 100}%` }}
            className="bg-saffron transition-all duration-500"
            title={`AI Auditor: ${llmContribution} / 40 pts`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-1.5 mt-2.5 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 flex-shrink-0" />
            <span className="truncate">Meta: <strong>{metaContribution}</strong>/30</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 flex-shrink-0" />
            <span className="truncate">Vision: <strong>{visionContribution}</strong>/30</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-saffron flex-shrink-0" />
            <span className="truncate">AI: <strong>{llmContribution}</strong>/40</span>
          </div>
        </div>
      </div>
    </div>
  );
};
