import React from 'react';
import { ShieldCheck, Flame } from 'lucide-react';
import type { ThreatAlert, SeverityLevel } from '../types/soc';

interface RiskPostureGaugeProps {
  alerts: ThreatAlert[];
}

export const RiskPostureGauge: React.FC<RiskPostureGaugeProps> = ({ alerts }) => {
  // Compute severity distribution
  const severityCounts = alerts.reduce<Record<SeverityLevel, number>>(
    (acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    },
    { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  );

  const total = alerts.length;

  // Compute composite risk score (0 to 100)
  const compositeScore = Math.min(
    100,
    Math.round(
      (severityCounts.CRITICAL * 30 +
        severityCounts.HIGH * 18 +
        severityCounts.MEDIUM * 8 +
        severityCounts.LOW * 3) /
        Math.max(1, total * 0.2)
    )
  );

  const getRiskColor = (score: number) => {
    if (score >= 70) return '#ff003c';
    if (score >= 40) return '#ffb800';
    return '#00ff88';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 75) return { text: 'CRITICAL COMPROMISE THREAT', color: 'text-cyber-red' };
    if (score >= 50) return { text: 'HIGH ANOMALY SURGE', color: 'text-orange-400' };
    if (score >= 25) return { text: 'ELEVATED SUSPICION', color: 'text-cyber-amber' };
    return { text: 'NORMAL SECURE STATE', color: 'text-cyber-green' };
  };

  const riskInfo = getRiskLabel(compositeScore);
  const strokeColor = getRiskColor(compositeScore);

  // SVG Gauge Calculations
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // Use a 270 degree arc
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (compositeScore / 100) * arcLength;

  return (
    <div className="bg-cyber-surface border border-cyber-border rounded-xl p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyber-border pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyber-cyan/20 border border-cyber-cyan/40 text-cyber-cyan">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono tracking-wider text-white">
              SECURITY POSTURE & RISK GAUGE
            </h3>
            <p className="text-[10px] text-cyber-muted font-mono">
              Fused Unsupervised Isolation Forest + Random Forest Severity Matrix
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-elevated border border-cyber-border text-cyber-muted">
          ASSET WEIGHT: 2.0x
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center flex-1">
        {/* Left: SVG Radial Gauge */}
        <div className="flex flex-col items-center justify-center p-2 relative">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-135" viewBox="0 0 160 160">
              {/* Background Track */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#161f2c"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeLinecap="round"
              />
              {/* Active Colored Arc */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={strokeColor}
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.5s ease',
                  filter: `drop-shadow(0 0 8px ${strokeColor}88)`,
                }}
              />
            </svg>

            {/* Center Score Readout */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span
                className="text-3xl font-extrabold font-mono tracking-tight"
                style={{ color: strokeColor }}
              >
                {compositeScore}
              </span>
              <span className="text-[10px] font-mono text-cyber-muted -mt-1">/ 100 RISK</span>
            </div>
          </div>

          <div className="text-center mt-1">
            <div className={`text-xs font-mono font-bold tracking-wider ${riskInfo.color}`}>
              {riskInfo.text}
            </div>
            <div className="text-[10px] text-cyber-muted font-mono mt-0.5">
              Multi-parameter Threat Index
            </div>
          </div>
        </div>

        {/* Right: Severity Distribution Breakdown */}
        <div className="flex flex-col justify-center space-y-2.5 font-mono text-xs">
          {/* Critical Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-cyber-red font-bold flex items-center gap-1">
                <Flame className="w-3 h-3" /> CRITICAL
              </span>
              <span className="text-white font-semibold">
                {severityCounts.CRITICAL}{' '}
                <span className="text-cyber-muted font-normal">
                  ({total > 0 ? Math.round((severityCounts.CRITICAL / total) * 100) : 0}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-cyber-bg rounded-full h-2 overflow-hidden border border-cyber-border">
              <div
                className="bg-cyber-red h-full rounded-full transition-all duration-500 glow-red"
                style={{
                  width: `${total > 0 ? (severityCounts.CRITICAL / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* High Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-orange-400 font-bold">HIGH</span>
              <span className="text-white font-semibold">
                {severityCounts.HIGH}{' '}
                <span className="text-cyber-muted font-normal">
                  ({total > 0 ? Math.round((severityCounts.HIGH / total) * 100) : 0}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-cyber-bg rounded-full h-2 overflow-hidden border border-cyber-border">
              <div
                className="bg-orange-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${total > 0 ? (severityCounts.HIGH / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Medium Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-cyber-amber font-bold">MEDIUM</span>
              <span className="text-white font-semibold">
                {severityCounts.MEDIUM}{' '}
                <span className="text-cyber-muted font-normal">
                  ({total > 0 ? Math.round((severityCounts.MEDIUM / total) * 100) : 0}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-cyber-bg rounded-full h-2 overflow-hidden border border-cyber-border">
              <div
                className="bg-cyber-amber h-full rounded-full transition-all duration-500"
                style={{
                  width: `${total > 0 ? (severityCounts.MEDIUM / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Low Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-cyber-cyan font-bold">LOW</span>
              <span className="text-white font-semibold">
                {severityCounts.LOW}{' '}
                <span className="text-cyber-muted font-normal">
                  ({total > 0 ? Math.round((severityCounts.LOW / total) * 100) : 0}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-cyber-bg rounded-full h-2 overflow-hidden border border-cyber-border">
              <div
                className="bg-cyber-cyan h-full rounded-full transition-all duration-500"
                style={{
                  width: `${total > 0 ? (severityCounts.LOW / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
