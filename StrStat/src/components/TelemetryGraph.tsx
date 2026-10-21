import React, { useState, useMemo } from 'react';
import { Activity, EyeOff, Radio, Layers, AlertTriangle } from 'lucide-react';
import { AccelSample } from '../types';
import { calculatePGA, mapPgaToMmi } from '../utils/structuralMath';

export interface TelemetryGraphProps {
  history: AccelSample[];
  isConnected: boolean;
  currentAccel?: { x: number; y: number; z: number };
}

export const TelemetryGraph: React.FC<TelemetryGraphProps> = ({
  history,
  isConnected,
  currentAccel
}) => {
  const [channels, setChannels] = useState({
    x: true,
    y: true,
    z: true
  });
  const [scaleG, setScaleG] = useState<number>(2.0); // ±g scale

  // Instantaneous PGA & MMI Evaluation
  const curPga = currentAccel
    ? calculatePGA(currentAccel.x, currentAccel.y, currentAccel.z)
    : history.length > 0
    ? (history[history.length - 1].pga ?? calculatePGA(history[history.length - 1].x, history[history.length - 1].y, history[history.length - 1].z))
    : 0;

  const mmiEval = mapPgaToMmi(curPga);

  // SVG dimensions for industrial SCADA oscilloscope
  const viewBoxWidth = 1000;
  const viewBoxHeight = 260;
  const zeroY = viewBoxHeight / 2;
  const maxSamples = 60;

  // Grid line parameters
  const divisionsY = 6;
  const divisionsX = 10;

  // Generate SVG polyline points for each channel
  const { pathX, pathY, pathZ } = useMemo(() => {
    if (history.length === 0) {
      return { pathX: '', pathY: '', pathZ: '' };
    }

    const len = history.length;
    const stepX = viewBoxWidth / (maxSamples - 1);
    const startX = viewBoxWidth - (len - 1) * stepX;

    const buildPoints = (key: 'x' | 'y' | 'z') => {
      return history
        .map((sample, i) => {
          const x = (startX + i * stepX).toFixed(1);
          // Zero-gravity offset removal: plot dynamic/AC Z (sample.z - 1.0)
          const val = key === 'z' ? sample.z - 1.0 : sample[key];
          const y = (zeroY - (val / scaleG) * (viewBoxHeight / 2)).toFixed(1);
          return `${x},${y}`;
        })
        .join(' ');
    };

    return {
      pathX: buildPoints('x'),
      pathY: buildPoints('y'),
      pathZ: buildPoints('z')
    };
  }, [history, scaleG, zeroY]);

  // Color mappings: X (Cyan), Y (Emerald), Z (Amber)
  const COLOR_X = '#06B6D4'; // Cyan
  const COLOR_Y = '#10B981'; // Emerald
  const COLOR_Z = '#F59E0B'; // Amber

  const rawZ = currentAccel ? currentAccel.z : history.length > 0 ? history[history.length - 1].z : 1.0;
  const dynZ = rawZ - 1.0;

  return (
    <div className="bg-[#0B0D13] border border-[#1E2433] rounded p-4 flex flex-col justify-between relative shadow-2xl">
      {/* Top Header Bar & Live SCADA Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-[#1E2433] pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            TRI-AXIAL SCADA OSCILLOSCOPE // MPU6050
          </h2>
          <span className="text-[10px] font-mono text-slate-500 bg-[#07090F] px-2 py-0.5 rounded border border-[#1E2433]">
            60 SAMPLES ROLLING
          </span>
        </div>

        {/* Live Instantaneous PGA & Current MMI Intensity Badge Directly Above Chart */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-2 bg-[#07090F] border border-[#1E2433] rounded px-3 py-1 text-[11px] tabular-nums">
            <span className="text-slate-500">PGA:</span>
            <span
              className={`font-semibold ${
                !isConnected
                  ? 'text-slate-600'
                  : curPga > 0.18
                  ? 'text-rose-400'
                  : curPga > 0.04
                  ? 'text-amber-400'
                  : 'text-cyan-300'
              }`}
            >
              {isConnected ? `${curPga.toFixed(4)} g` : '--'}
            </span>

            <span className="text-[#1E2433] font-bold">|</span>

            {/* Current MMI Intensity Badge */}
            <span className="text-slate-500">MMI SCALE:</span>
            <span
              className={`px-2 py-0.5 rounded border font-semibold text-[10px] tracking-wider uppercase transition-colors ${
                !isConnected
                  ? 'bg-slate-900 border-slate-800 text-slate-600'
                  : curPga > 0.65
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse'
                  : curPga > 0.18
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {isConnected ? `${mmiEval.roman} • ${mmiEval.hazard}` : 'OFFLINE'}
            </span>
          </div>

          {/* High-Contrast Channel Selection Buttons */}
          <div className="flex items-center gap-1 bg-[#07090F] border border-[#1E2433] rounded p-0.5">
            {/* X: Cyan */}
            <button
              onClick={() => setChannels((p) => ({ ...p, x: !p.x }))}
              className={`px-2 py-0.5 rounded text-[11px] transition flex items-center gap-1.5 ${
                channels.x
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-semibold'
                  : 'text-slate-600 border border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>X: {isConnected && currentAccel ? `${currentAccel.x.toFixed(2)}g` : '--'}</span>
            </button>

            {/* Y: Emerald */}
            <button
              onClick={() => setChannels((p) => ({ ...p, y: !p.y }))}
              className={`px-2 py-0.5 rounded text-[11px] transition flex items-center gap-1.5 ${
                channels.y
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold'
                  : 'text-slate-600 border border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Y: {isConnected && currentAccel ? `${currentAccel.y.toFixed(2)}g` : '--'}</span>
            </button>

            {/* Z: Amber with Raw and Dynamic breakdown */}
            <button
              onClick={() => setChannels((p) => ({ ...p, z: !p.z }))}
              className={`px-2 py-0.5 rounded text-[11px] transition flex items-center gap-1.5 ${
                channels.z
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold'
                  : 'text-slate-600 border border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>
                {isConnected
                  ? `Z (Raw): ${rawZ.toFixed(2)}g • Z (Dyn): ${dynZ >= 0 ? '+' : ''}${dynZ.toFixed(2)}g`
                  : 'Z: --'}
              </span>
            </button>
          </div>

          {/* Scale Selector */}
          <div className="flex items-center bg-[#07090F] border border-[#1E2433] rounded px-2.5 py-1 text-[11px]">
            <span className="text-slate-500 mr-1.5">SCALE:</span>
            <select
              value={scaleG}
              onChange={(e) => setScaleG(Number(e.target.value))}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value={1.5} className="bg-[#0B0D13]">±1.5g</option>
              <option value={2.0} className="bg-[#0B0D13]">±2.0g</option>
              <option value={4.0} className="bg-[#0B0D13]">±4.0g</option>
              <option value={8.0} className="bg-[#0B0D13]">±8.0g</option>
            </select>
          </div>
        </div>
      </div>

      {/* Industrial SCADA Oscilloscope SVG Viewport */}
      <div className="relative w-full rounded border border-[#1E2433] bg-[#0B0D13] overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-56 md:h-64 block"
          preserveAspectRatio="none"
        >
          {/* Background fill */}
          <rect width={viewBoxWidth} height={viewBoxHeight} fill="#0B0D13" />

          {/* Fine horizontal grid lines (#1E2433) */}
          {Array.from({ length: divisionsY + 1 }).map((_, i) => {
            const y = (viewBoxHeight / divisionsY) * i;
            const gVal = scaleG - (i * (2 * scaleG)) / divisionsY;
            return (
              <g key={`h-grid-${i}`}>
                <line
                  x1={0}
                  y1={y}
                  x2={viewBoxWidth}
                  y2={y}
                  stroke="#1E2433"
                  strokeWidth="1"
                />
                <text
                  x={8}
                  y={y - 4}
                  fill="#475569"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {gVal > 0 ? '+' : ''}{gVal.toFixed(1)}g
                </text>
              </g>
            );
          })}

          {/* Fine vertical time division grid lines (#1E2433) */}
          {Array.from({ length: divisionsX + 1 }).map((_, j) => {
            const x = (viewBoxWidth / divisionsX) * j;
            return (
              <line
                key={`v-grid-${j}`}
                x1={x}
                y1={0}
                x2={x}
                y2={viewBoxHeight}
                stroke="#1E2433"
                strokeWidth="1"
              />
            );
          })}

          {/* Zero Datum Baseline */}
          <line
            x1={0}
            y1={zeroY}
            x2={viewBoxWidth}
            y2={zeroY}
            stroke="#273248"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />

          {/* 1.0g Earth Gravity Reference Line */}
          {(() => {
            const g1Y = zeroY - (1.0 / scaleG) * (viewBoxHeight / 2);
            if (g1Y >= 0 && g1Y <= viewBoxHeight) {
              return (
                <g>
                  <line
                    x1={0}
                    y1={g1Y}
                    x2={viewBoxWidth}
                    y2={g1Y}
                    stroke="rgba(56, 189, 248, 0.2)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={viewBoxWidth - 110}
                    y={g1Y - 4}
                    fill="#38BDF8"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    opacity={0.6}
                  >
                    1.0g GRAVITY DATUM
                  </text>
                </g>
              );
            }
            return null;
          })()}

          {/* High-Contrast Acceleration Traces */}
          {history.length > 1 && (
            <>
              {/* Channel X: Cyan */}
              {channels.x && pathX && (
                <polyline
                  points={pathX}
                  fill="none"
                  stroke={COLOR_X}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isConnected ? 0.95 : 0.45}
                />
              )}

              {/* Channel Y: Emerald */}
              {channels.y && pathY && (
                <polyline
                  points={pathY}
                  fill="none"
                  stroke={COLOR_Y}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isConnected ? 0.95 : 0.45}
                />
              )}

              {/* Channel Z: Amber */}
              {channels.z && pathZ && (
                <polyline
                  points={pathZ}
                  fill="none"
                  stroke={COLOR_Z}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isConnected ? 0.95 : 0.45}
                />
              )}
            </>
          )}
        </svg>

        {/* Frozen Trace Disconnected Overlay */}
        {!isConnected && (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
            <div className="border border-rose-500/50 bg-rose-500/10 text-rose-400 px-4 py-2 rounded flex items-center gap-2 text-xs font-mono tracking-widest uppercase mb-1.5 shadow-2xl">
              <EyeOff className="w-4 h-4 text-rose-400" />
              <span>DATA STREAM SEVERED</span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono text-center max-w-sm">
              Watchdog breach: No packet received for &gt; 1500ms. Telemetry trace frozen at last valid snapshot.
            </p>
          </div>
        )}
      </div>

      {/* Industrial SCADA Footer Strip */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-400' : 'bg-rose-500'
            }`}
          ></span>
          <span>
            {isConnected
              ? 'ACTIVE SCADA HARVEST • 50 Hz NOMINAL'
              : 'ACQUISITION HALTED • HARDWARE STANDBY'}
          </span>
        </div>
        <div>CALIBRATION: ±2g DYNAMIC RANGE • ZERO GRAVITY OFFSET REMOVED</div>
      </div>
    </div>
  );
};
