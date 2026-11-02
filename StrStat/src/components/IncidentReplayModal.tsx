import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  X,
  FastForward,
  Download,
  Activity,
  Layers,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import { IncidentFlightSnapshot } from '../types';

export interface IncidentReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  replayBuffer: IncidentFlightSnapshot[];
  currentIndex: number;
  onSeek: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: 1 | 2;
  onChangeSpeed: (speed: 1 | 2) => void;
  onStep: (delta: number) => void;
  onExportCSV: () => void;
}

export const IncidentReplayModal: React.FC<IncidentReplayModalProps> = ({
  isOpen,
  onClose,
  replayBuffer,
  currentIndex,
  onSeek,
  isPlaying,
  onTogglePlay,
  speed,
  onChangeSpeed,
  onStep,
  onExportCSV
}) => {
  if (!isOpen || replayBuffer.length === 0) return null;

  const totalFrames = replayBuffer.length;
  const currentFrame = replayBuffer[currentIndex] || replayBuffer[0];
  const maxTime = replayBuffer[totalFrames - 1]?.elapsedSec || 15.0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0B0D13] border border-cyan-500/40 rounded-lg max-w-3xl w-full p-4 md:p-5 shadow-[0_0_30px_rgba(6,182,212,0.15)] font-mono text-slate-200 flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1F2430] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></div>
            <div>
              <h2 className="text-xs md:text-sm font-bold tracking-widest text-cyan-300 uppercase flex items-center gap-2">
                INCIDENT FLIGHT REPLAY // SEISMOGRAM TIME-MACHINE
              </h2>
              <span className="text-[10px] text-slate-500 tracking-wider block">
                SCRUBBING BUFFER STREAMING TO 3D DIGITAL TWIN & OSCILLOSCOPE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportCSV}
              className="px-2.5 py-1 rounded bg-[#161D2B] hover:bg-[#20293D] border border-[#2D374D] text-xs text-slate-300 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>EXPORT CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
              title="Close Replay Mode"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Frame Telemetry Snapshot Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-[#07090F] border border-[#1F2430] rounded p-2.5 text-xs tabular-nums">
          <div>
            <span className="text-[9px] text-slate-500 uppercase block">FRAME TIME</span>
            <span className="text-cyan-300 font-bold">
              {currentFrame.elapsedSec.toFixed(2)}s
              <span className="text-[10px] text-slate-500 font-normal"> / {maxTime.toFixed(1)}s</span>
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase block">DYNAMIC PGA</span>
            <span
              className={`font-bold ${
                currentFrame.pga_g > 0.34
                  ? 'text-rose-400'
                  : currentFrame.pga_g > 0.12
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {currentFrame.pga_g.toFixed(4)} g
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase block">MMI SCALE</span>
            <span className="text-amber-300 font-bold">
              {currentFrame.mmi_roman} • {currentFrame.hazard_level}
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase block">FREQ (f_exc)</span>
            <span className="text-slate-200 font-bold">{currentFrame.dominant_freq_hz.toFixed(2)} Hz</span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase block">DRIFT (vs 4Hz)</span>
            <span
              className={`font-bold ${
                Math.abs(currentFrame.drift_percent) > 20
                  ? 'text-rose-400'
                  : Math.abs(currentFrame.drift_percent) > 10
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {currentFrame.drift_percent > 0 ? '+' : ''}
              {currentFrame.drift_percent.toFixed(1)}%
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase block">INFERENCE</span>
            <span
              className={`font-bold uppercase ${
                currentFrame.inference_state === 'SEISMIC_EVENT'
                  ? 'text-rose-400'
                  : currentFrame.inference_state === 'RESONANCE_WARNING'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {currentFrame.inference_state}
            </span>
          </div>
        </div>

        {/* Timeline Scrubbing Slider */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>TIMELINE SCRUBBER</span>
            </span>
            <span className="text-cyan-300 font-semibold tabular-nums">
              INDEX: {currentIndex + 1} / {totalFrames}
            </span>
          </div>

          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentIndex}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 tabular-nums">
            <span>0.00s (TRIGGER T₀)</span>
            <span>7.50s</span>
            <span>{maxTime.toFixed(2)}s (BUFFER TAIL)</span>
          </div>
        </div>

        {/* Playback Controls Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1F2430] pt-3.5">
          <div className="flex items-center gap-2">
            {/* Step Back */}
            <button
              onClick={() => onStep(-1)}
              className="p-2 rounded bg-[#141926] hover:bg-[#1E2538] border border-[#232B3E] text-slate-300 transition"
              title="Step backward 1 frame"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play / Pause Toggle */}
            <button
              onClick={onTogglePlay}
              className={`px-4 py-2 rounded border text-xs font-bold transition flex items-center gap-2 ${
                isPlaying
                  ? 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/50 text-cyan-300'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-emerald-300" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            {/* Step Forward */}
            <button
              onClick={() => onStep(1)}
              className="p-2 rounded bg-[#141926] hover:bg-[#1E2538] border border-[#232B3E] text-slate-300 transition"
              title="Step forward 1 frame"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Restart */}
            <button
              onClick={() => onSeek(0)}
              className="p-2 rounded bg-[#141926] hover:bg-[#1E2538] border border-[#232B3E] text-slate-400 hover:text-slate-200 transition"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 bg-[#07090F] border border-[#1F2430] rounded p-1 text-xs">
            <span className="text-slate-500 text-[10px] px-1">SPEED:</span>
            <button
              onClick={() => onChangeSpeed(1)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition ${
                speed === 1
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1x
            </button>
            <button
              onClick={() => onChangeSpeed(2)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition ${
                speed === 2
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2x
            </button>
          </div>

          {/* Exit Replay Button */}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <span>EXIT REPLAY</span>
          </button>
        </div>
      </div>
    </div>
  );
};

