import React, { useMemo } from 'react';
import { Radio, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { FftData, InferenceState } from '../types';
import { calculateResonantFrequencyDrift, NOMINAL_BASELINE_FREQ_HZ } from '../utils/structuralMath';

export interface ResonanceSpectrumProps {
  fft?: FftData;
  inferenceState?: InferenceState;
  anomalyScore?: number;
  isConnected: boolean;
  nominalBaselineHz?: number;
  dangerBandMin?: number; // 1.0 Hz
  dangerBandMax?: number; // 8.0 Hz
  className?: string;
}

const NYQUIST_MAX_HZ = 25.0;

export const ResonanceSpectrum: React.FC<ResonanceSpectrumProps> = ({
  fft,
  inferenceState,
  anomalyScore,
  isConnected,
  nominalBaselineHz = NOMINAL_BASELINE_FREQ_HZ,
  dangerBandMin = 1.0,
  dangerBandMax = 8.0,
  className = ''
}) => {
  const dominantFreq = fft?.dominant_freq_hz ?? 0;
  const peakMagnitude = fft?.peak_magnitude ?? 0;
  const score = anomalyScore ?? 0;

  // Unified State & Threshold Synchronization
  // 1. SEISMIC_EVENT: anomalyScore >= 0.70 or state === 'SEISMIC_EVENT'
  // 2. RESONANCE_WARNING: 0.40 <= anomalyScore < 0.70 OR (dominantFreq inside 1-8Hz with elevated peak magnitude > 0.45)
  // 3. NOMINAL: anomalyScore < 0.40 AND peak spectral amplitude within safe margin
  const isSeismic = isConnected && (inferenceState === 'SEISMIC_EVENT' || score >= 0.70);
  const isResonanceAlert =
    isConnected &&
    !isSeismic &&
    (inferenceState === 'RESONANCE_WARNING' ||
      (score >= 0.40 && score < 0.70) ||
      (dominantFreq >= dangerBandMin && dominantFreq <= dangerBandMax && peakMagnitude > 0.45));
  const isNominal = isConnected && !isSeismic && !isResonanceAlert;

  // Resonant frequency drift percentage from nominal baseline f0 = 4.0 Hz
  const driftPercent = calculateResonantFrequencyDrift(dominantFreq, nominalBaselineHz);

  // Generate frequency bins across full 0 - 25 Hz Nyquist window (50 bins at 0.5 Hz resolution)
  const frequencyBins = useMemo(() => {
    const bins: number[] = [];
    for (let f = 0.5; f <= NYQUIST_MAX_HZ; f += 0.5) {
      bins.push(Number(f.toFixed(1)));
    }
    return bins;
  }, []);

  // SVG dimensions for spectrum visualization
  const width = 600;
  const height = 150;
  const paddingBottom = 22;
  const paddingTop = 15;
  const chartHeight = height - paddingBottom - paddingTop;

  // Convert Hz (0 to 25.0) to X pixel coordinate
  const freqToX = (hz: number) => {
    return (hz / NYQUIST_MAX_HZ) * width;
  };

  const xMinDanger = freqToX(dangerBandMin);
  const xMaxDanger = freqToX(dangerBandMax);

  return (
    <div
      className={`bg-[#0B0D13] border ${
        isSeismic
          ? 'border-rose-500/70 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          : isResonanceAlert
          ? 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
          : 'border-[#1E2433]'
      } rounded p-4 flex flex-col justify-between transition-colors duration-200 ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2433] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            RESONANCE SPECTRUM // FFT DOMAIN
          </h3>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
          <span className="bg-[#07090F] border border-[#1E2433] px-2 py-0.5 rounded text-cyan-300">
            BAND: 0.0 - 25.0 Hz
          </span>
          <span className="bg-[#07090F] border border-[#1E2433] px-2 py-0.5 rounded text-amber-400">
            DANGER: {dangerBandMin.toFixed(1)} - {dangerBandMax.toFixed(1)} Hz
          </span>
        </div>
      </div>

      {/* Primary Metrics: Dominant Freq, Drift Delta Readout, Peak Magnitude */}
      <div className="grid grid-cols-3 gap-2 py-1 font-mono text-xs border-b border-[#1E2433]/70 pb-3 mb-3">
        {/* Dominant Frequency */}
        <div>
          <span className="text-[10px] text-slate-500 block uppercase">DOMINANT FREQ (f_exc):</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-2xl font-bold tabular-nums ${
                !isConnected
                  ? 'text-slate-600'
                  : isSeismic
                  ? 'text-rose-400'
                  : isResonanceAlert
                  ? 'text-amber-400'
                  : 'text-slate-100'
              }`}
            >
              {isConnected && dominantFreq > 0 ? dominantFreq.toFixed(2) : '--'}
            </span>
            <span className="text-xs text-slate-500">Hz</span>
          </div>
        </div>

        {/* Delta Readout: Resonant Frequency Drift */}
        <div className="text-center border-x border-[#1E2433]/60 px-2">
          <span className="text-[10px] text-slate-500 block uppercase">
            DRIFT vs f₀ ({nominalBaselineHz.toFixed(1)} Hz):
          </span>
          <div className="flex items-baseline justify-center gap-1 mt-0.5">
            <span
              className={`text-2xl font-bold tabular-nums ${
                !isConnected || dominantFreq === 0
                  ? 'text-slate-600'
                  : Math.abs(driftPercent) > 20
                  ? 'text-rose-400'
                  : Math.abs(driftPercent) > 10
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {isConnected && dominantFreq > 0
                ? `${driftPercent > 0 ? '+' : ''}${driftPercent.toFixed(1)}%`
                : '--'}
            </span>
            <span className="text-[10px] text-slate-500">Δ shift</span>
          </div>
        </div>

        {/* Spectral Peak Magnitude */}
        <div className="text-right">
          <span className="text-[10px] text-slate-500 block uppercase">SPECTRAL PEAK:</span>
          <div className="flex items-baseline justify-end gap-1 mt-0.5">
            <span
              className={`text-2xl font-bold tabular-nums ${
                !isConnected
                  ? 'text-slate-600'
                  : isResonanceAlert || isSeismic
                  ? 'text-amber-400'
                  : 'text-cyan-300'
              }`}
            >
              {isConnected && peakMagnitude > 0 ? peakMagnitude.toFixed(3) : '--'}
            </span>
            <span className="text-xs text-slate-500">g²/Hz</span>
          </div>
        </div>
      </div>

      {/* SVG Frequency Distribution with Full 0-25 Hz Nyquist Range */}
      <div className="relative w-full rounded border border-[#1E2433] bg-[#07090F] overflow-hidden p-1.5 select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 md:h-40 block"
          preserveAspectRatio="none"
        >
          {/* Subtle Grid horizontal divisions */}
          {[0.25, 0.5, 0.75, 1.0].map((frac) => {
            const y = paddingTop + chartHeight * (1 - frac);
            return (
              <line
                key={`grid-y-${frac}`}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke="#161B26"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            );
          })}

          {/* Highlighted Structural Hazard Zone (1.0 Hz - 8.0 Hz) */}
          <rect
            x={xMinDanger}
            y={paddingTop}
            width={xMaxDanger - xMinDanger}
            height={chartHeight}
            fill={isResonanceAlert ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.05)'}
          />

          {/* Danger Band Minimum Threshold Line (1.0 Hz - Amber) */}
          <line
            x1={xMinDanger}
            y1={paddingTop}
            x2={xMinDanger}
            y2={paddingTop + chartHeight}
            stroke="#F59E0B"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <text
            x={xMinDanger + 4}
            y={paddingTop + 10}
            fill="#F59E0B"
            fontSize="8"
            fontFamily="JetBrains Mono, monospace"
            opacity={0.85}
          >
            1.0 Hz
          </text>

          {/* Danger Band Maximum Threshold Line (8.0 Hz - Amber/Red) */}
          <line
            x1={xMaxDanger}
            y1={paddingTop}
            x2={xMaxDanger}
            y2={paddingTop + chartHeight}
            stroke="#EF4444"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <text
            x={xMaxDanger - 64}
            y={paddingTop + 10}
            fill="#EF4444"
            fontSize="8"
            fontFamily="JetBrains Mono, monospace"
            opacity={0.85}
          >
            8.0 Hz CEILING
          </text>

          {/* Baseline f0 = 4.0 Hz Marker Line */}
          {(() => {
            const xBase = freqToX(nominalBaselineHz);
            return (
              <g>
                <line
                  x1={xBase}
                  y1={paddingTop}
                  x2={xBase}
                  y2={paddingTop + chartHeight}
                  stroke="#06B6D4"
                  strokeWidth="1"
                  strokeDasharray="1 3"
                />
                <text
                  x={xBase - 18}
                  y={paddingTop + chartHeight - 4}
                  fill="#06B6D4"
                  fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                  opacity={0.7}
                >
                  f₀=4.0Hz
                </text>
              </g>
            );
          })()}

          {/* Frequency Bins Spectral Bars across 0 - 25 Hz */}
          {frequencyBins.map((binFreq) => {
            const barX = freqToX(binFreq) - (width / frequencyBins.length) * 0.4;
            const barWidth = Math.max(2.5, (width / frequencyBins.length) * 0.8);

            // Compute synthetic spectral distribution envelope centered on dominant frequency
            let relativeMag = 0.04;
            if (isConnected && dominantFreq > 0) {
              const diff = Math.abs(dominantFreq - binFreq);
              const sigma = 0.7;
              const gaussian = Math.exp(-(diff * diff) / (2 * sigma * sigma));
              relativeMag = Math.max(0.04, Math.min(1.0, gaussian * Math.max(0.2, peakMagnitude * 1.4)));
            }

            const barHeight = chartHeight * relativeMag;
            const barY = paddingTop + chartHeight - barHeight;

            const isHazardBin = binFreq >= dangerBandMin && binFreq <= dangerBandMax;
            const isPeakBin = isConnected && Math.abs(dominantFreq - binFreq) < 0.35;

            const barColor = !isConnected
              ? '#1E293B'
              : isPeakBin && isSeismic
              ? '#EF4444'
              : isPeakBin && isResonanceAlert
              ? '#F59E0B'
              : isPeakBin
              ? '#06B6D4'
              : isHazardBin
              ? 'rgba(217, 119, 6, 0.55)'
              : 'rgba(16, 185, 129, 0.45)';

            return (
              <rect
                key={`bin-${binFreq}`}
                x={barX}
                y={barY}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                rx="1"
              />
            );
          })}

          {/* Bottom Frequency Axis Labels across 0 - 25 Hz (Ticks every 5 Hz) */}
          {[0, 5, 10, 15, 20, 25].map((fTick) => {
            const x = freqToX(fTick);
            return (
              <g key={`tick-${fTick}`}>
                <line
                  x1={x}
                  y1={paddingTop + chartHeight}
                  x2={x}
                  y2={paddingTop + chartHeight + 4}
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x={x === 0 ? x : x - 6}
                  y={height - 6}
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {fTick}Hz
                </text>
              </g>
            );
          })}
        </svg>

        {/* Offline Overlay */}
        {!isConnected && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider bg-[#0B0D13] border border-[#1E2433] px-3 py-1 rounded">
              AWAITING FFT SPECTRUM STREAM
            </span>
          </div>
        )}
      </div>

      {/* Bottom Technical Status Banner */}
      <div className="mt-3 pt-2.5 border-t border-[#1E2433] flex flex-wrap items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2">
          {isSeismic ? (
            <ShieldAlert className="w-4 h-4 text-rose-500 animate-ping" />
          ) : isResonanceAlert ? (
            <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          )}
          <span
            className={
              !isConnected
                ? 'text-slate-600'
                : isSeismic
                ? 'text-rose-400 font-semibold'
                : isResonanceAlert
                ? 'text-amber-400 font-semibold'
                : 'text-emerald-400'
            }
          >
            {isConnected
              ? isSeismic
                ? 'SEISMIC EXCITATION THRESHOLD BREACH'
                : isResonanceAlert
                ? 'HARMONIC RESONANCE ALERT'
                : 'NOMINAL HARMONICS // NO EXCITATION LOCK'
              : 'SENSOR FFT OFFLINE'}
          </span>
        </div>

        <div className="text-[10px] text-slate-500">
          WINDOW: 64 SAMPLES • NYQUIST: 25.0 Hz
        </div>
      </div>
    </div>
  );
};
