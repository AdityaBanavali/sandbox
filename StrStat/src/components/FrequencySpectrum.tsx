import React from 'react';
import { Radio, AlertTriangle, TrendingUp } from 'lucide-react';
import { FftData } from '../types';
import { calculateResonantFrequencyDrift, NOMINAL_BASELINE_FREQ_HZ } from '../utils/structuralMath';

interface FrequencySpectrumProps {
  fft?: FftData;
  isConnected: boolean;
}

export const FrequencySpectrum: React.FC<FrequencySpectrumProps> = ({
  fft,
  isConnected
}) => {
  const dominantFreq = fft?.dominant_freq_hz ?? 0;
  const peakMagnitude = fft?.peak_magnitude ?? 0;
  const driftPercent = calculateResonantFrequencyDrift(dominantFreq, NOMINAL_BASELINE_FREQ_HZ);

  // Structural danger zone: 2.8 - 3.8 Hz (centered around natural frequency band)
  const isResonanceZone = isConnected && dominantFreq >= 2.6 && dominantFreq <= 3.8;

  // Synthesize spectrum envelope distribution across 1 - 10 Hz bins for visual feedback
  const bins = [1.0, 2.0, 3.0, 3.2, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];

  return (
    <div className="bg-[#111318] border border-[#1F2430] rounded p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-[#1F2430] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            FREQUENCY SPECTRUM // FFT RESONANCE
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500">BAND: 0 - 12 Hz</span>
      </div>

      <div className="my-2 space-y-3">
        {/* Dominant metrics & Drift */}
        <div className="flex items-baseline justify-between font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">DOMINANT FREQ (f_exc):</span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-semibold tabular-nums ${
                  !isConnected ? 'text-slate-600' : isResonanceZone ? 'text-[#F59E0B]' : 'text-slate-100'
                }`}
              >
                {isConnected ? dominantFreq.toFixed(2) : '--'}
              </span>
              <span className="text-xs text-slate-500">Hz</span>
            </div>
          </div>

          <div className="text-center">
            <span className="text-[10px] text-slate-500 block uppercase">DRIFT vs f₀ (4.0 Hz):</span>
            <div className="flex items-baseline gap-1 justify-center">
              <span
                className={`text-base font-semibold tabular-nums ${
                  !isConnected
                    ? 'text-slate-600'
                    : Math.abs(driftPercent) > 15
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              >
                {isConnected ? `${driftPercent > 0 ? '+' : ''}${driftPercent.toFixed(1)}%` : '--'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 block uppercase">PEAK MAGNITUDE:</span>
            <div className="flex items-baseline gap-1.5 justify-end">
              <span className="text-xl font-semibold text-slate-200 tabular-nums">
                {isConnected ? peakMagnitude.toFixed(3) : '--'}
              </span>
              <span className="text-xs text-slate-500">g²/Hz</span>
            </div>
          </div>
        </div>

        {/* Frequency Bins Visualization */}
        <div className="bg-[#090A0F] border border-[#1F2430] rounded p-2.5">
          <div className="flex items-end justify-between h-20 gap-1.5 pt-2">
            {bins.map((f) => {
              // Calculate relative height based on closeness to dominant frequency
              let heightPct = 8;
              if (isConnected && dominantFreq > 0) {
                const diff = Math.abs(dominantFreq - f);
                const weight = Math.max(0, 1 - diff / 1.5);
                heightPct = Math.min(100, Math.max(8, weight * peakMagnitude * 120 + 8));
              }

              const isDangerBin = f >= 2.8 && f <= 3.6;

              return (
                <div key={f} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div
                    className={`w-full rounded-t-sm transition-all duration-150 ${
                      !isConnected
                        ? 'bg-slate-800'
                        : isDangerBin && isResonanceZone
                        ? 'bg-[#F59E0B]'
                        : isDangerBin
                        ? 'bg-amber-800/60'
                        : 'bg-emerald-600/70'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  ></div>
                  <span className="text-[9px] font-mono text-slate-600 mt-1">{f}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-slate-500 border-t border-[#1F2430]/60 pt-1">
            <span>0 Hz</span>
            <span className="text-amber-500/80 font-semibold">RESONANCE CRITICAL (fn ~ 3.2 Hz)</span>
            <span>10 Hz</span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1F2430] pt-2 text-[10px] font-mono flex items-center justify-between">
        <span className="text-slate-500">DYNAMIC ZONE CHECK:</span>
        <span
          className={`font-semibold ${
            !isConnected
              ? 'text-slate-600'
              : isResonanceZone
              ? 'text-[#F59E0B] flex items-center gap-1'
              : 'text-[#10B981]'
          }`}
        >
          {isConnected
            ? isResonanceZone
              ? 'STRUCTURAL RESONANCE RISK'
              : 'STABLE (OUTSIDE fn BAND)'
            : 'DISCONNECTED'}
        </span>
      </div>
    </div>
  );
};
