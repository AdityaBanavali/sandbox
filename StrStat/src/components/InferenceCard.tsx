import React from 'react';
import { Cpu, AlertOctagon, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { InferenceData, InferenceState } from '../types';

interface InferenceCardProps {
  inference?: InferenceData;
  isConnected: boolean;
}

export const InferenceCard: React.FC<InferenceCardProps> = ({
  inference,
  isConnected
}) => {
  const state: InferenceState = inference?.state ?? 'NOMINAL';
  const anomalyScore = inference?.anomaly_score ?? 0;
  const probability = inference?.probability ?? 0;
  const latency = inference?.inference_latency_ms ?? 0;

  // Visual status indicators
  const getStatusPresentation = () => {
    if (!isConnected) {
      return {
        label: 'AWAITING EDGE INFERENCE',
        badge: 'OFFLINE',
        color: 'border-slate-800 text-slate-500 bg-slate-900/40',
        dot: 'bg-slate-700',
        icon: Cpu
      };
    }

    switch (state) {
      case 'SEISMIC_EVENT':
        return {
          label: 'CRITICAL SEISMIC THRESHOLD BREACH',
          badge: 'CRITICAL HAZARD',
          color: 'border-[#EF4444]/60 text-[#EF4444] bg-[#EF4444]/10',
          dot: 'bg-[#EF4444] animate-ping',
          icon: AlertOctagon
        };
      case 'RESONANCE_WARNING':
        return {
          label: 'MECHANICAL RESONANCE DETECTED',
          badge: 'ELEVATED RISK',
          color: 'border-[#F59E0B]/60 text-[#F59E0B] bg-[#F59E0B]/10',
          dot: 'bg-[#F59E0B] animate-pulse',
          icon: AlertTriangle
        };
      case 'NOMINAL':
      default:
        return {
          label: 'NOMINAL INTEGRITY',
          badge: 'NOMINAL',
          color: 'border-[#10B981]/50 text-[#10B981] bg-[#10B981]/10',
          dot: 'bg-[#10B981]',
          icon: CheckCircle2
        };
    }
  };

  const status = getStatusPresentation();
  const StatusIcon = status.icon;

  // Warning brackets for anomaly score:
  // 0.0 - 0.3: Nominal (Emerald)
  // 0.3 - 0.6: Warning (Amber)
  // 0.6 - 1.0: Hazard (Crimson)
  const getScoreColor = (score: number) => {
    if (!isConnected) return 'bg-slate-800';
    if (score > 0.6) return 'bg-[#EF4444]';
    if (score > 0.3) return 'bg-[#F59E0B]';
    return 'bg-[#10B981]';
  };

  return (
    <div className="bg-[#111318] border border-[#1F2430] rounded p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-[#1F2430] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            TINYML ON-DEVICE INFERENCE // TFLITE MICRO
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          CYCLE: {isConnected ? `${latency}ms` : '--'}
        </span>
      </div>

      {/* State Banner */}
      <div className={`p-3 rounded border flex items-center justify-between gap-3 mb-3 ${status.color}`}>
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`}></span>
          <div>
            <span className="text-[10px] font-mono block tracking-wider uppercase opacity-75">
              CURRENT STATE INDICATOR
            </span>
            <span className="text-xs font-mono font-semibold tracking-wide">
              {status.label}
            </span>
          </div>
        </div>
        <StatusIcon className="w-5 h-5 flex-shrink-0" />
      </div>

      {/* Anomaly Gauge & Probability */}
      <div className="space-y-3 font-mono text-xs">
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[10px] text-slate-500 uppercase">ANOMALY SCORE:</span>
            <span className="text-base font-semibold tabular-nums text-slate-100">
              {isConnected ? anomalyScore.toFixed(2) : '--'}
              <span className="text-[10px] text-slate-500 font-normal ml-1">/ 1.00</span>
            </span>
          </div>

          {/* Stepped Anomaly Bar */}
          <div className="w-full bg-[#090A0F] border border-[#1F2430] rounded-sm h-3 p-0.5 flex gap-0.5">
            {Array.from({ length: 20 }, (_, i) => {
              const bracketThreshold = (i + 1) * 0.05;
              const isActive = isConnected && anomalyScore >= bracketThreshold;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-[1px] transition-colors duration-150 ${
                    isActive ? getScoreColor(bracketThreshold) : 'bg-slate-900'
                  }`}
                ></div>
              );
            })}
          </div>

          <div className="flex justify-between text-[9px] text-slate-600 mt-1">
            <span>0.00 (NOMINAL)</span>
            <span>0.30 (ELEVATED)</span>
            <span>0.60 (CRITICAL)</span>
            <span>1.00</span>
          </div>
        </div>

        {/* Probability Metric */}
        <div className="flex justify-between items-center pt-2 border-t border-[#1F2430] text-xs">
          <span className="text-slate-500 text-[11px]">EVENT CONFIDENCE / PROB:</span>
          <span className="font-semibold tabular-nums text-slate-200">
            {isConnected ? `${(probability * 100).toFixed(1)}%` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};
