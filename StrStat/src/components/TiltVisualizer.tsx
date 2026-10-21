import React from 'react';
import { Compass, AlertCircle } from 'lucide-react';

interface TiltVisualizerProps {
  pitch?: number;
  roll?: number;
  isConnected: boolean;
}

export const TiltVisualizer: React.FC<TiltVisualizerProps> = ({
  pitch = 0,
  roll = 0,
  isConnected
}) => {
  const maxDeg = 15; // Threshold bounds ±15 deg
  const safeLimitDeg = 5; // Safe threshold

  // Constrain bubble position inside circle
  const pitchClamped = Math.max(-maxDeg, Math.min(maxDeg, pitch));
  const rollClamped = Math.max(-maxDeg, Math.min(maxDeg, roll));

  // Map to SVG coordinates (0 - 100 with center at 50, 50)
  // X = Roll, Y = -Pitch
  const bubbleX = isConnected ? 50 + (rollClamped / maxDeg) * 38 : 50;
  const bubbleY = isConnected ? 50 - (pitchClamped / maxDeg) * 38 : 50;

  const totalDeflection = Math.sqrt(pitch * pitch + roll * roll);
  const isElevated = totalDeflection > safeLimitDeg;

  return (
    <div className="bg-[#111318] border border-[#1F2430] rounded p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-[#1F2430] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
            TILT & ANGULAR DEFLECTION // GYRO
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500">MAX: ±{maxDeg}°</span>
      </div>

      <div className="flex items-center justify-around gap-4 py-2">
        {/* Reticle Visualizer */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {/* Outer bounds */}
            <circle cx="50" cy="50" r="46" fill="#090A0F" stroke="#1F2430" strokeWidth="1.5" />
            
            {/* Safe threshold ring (5 deg) */}
            <circle
              cx="50"
              cy="50"
              r={(safeLimitDeg / maxDeg) * 38}
              fill="none"
              stroke="#272F40"
              strokeDasharray="2,2"
              strokeWidth="1"
            />

            {/* Reticle Crosshairs */}
            <line x1="50" y1="6" x2="50" y2="94" stroke="#1F2430" strokeWidth="1" />
            <line x1="6" y1="50" x2="94" y2="50" stroke="#1F2430" strokeWidth="1" />

            {/* Center target dot */}
            <circle cx="50" cy="50" r="1.5" fill="#475569" />

            {/* Tilt Bubble Indicator */}
            <circle
              cx={bubbleX}
              cy={bubbleY}
              r="5.5"
              fill={!isConnected ? '#334155' : isElevated ? '#EF4444' : '#10B981'}
              stroke="#090A0F"
              strokeWidth="1.5"
              className="transition-all duration-150"
            />
          </svg>
        </div>

        {/* Numeric Telemetry Readouts */}
        <div className="space-y-2.5 font-mono text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider">PITCH DEVIATION:</span>
            <span className="text-base font-semibold text-slate-200 tabular-nums">
              {isConnected ? `${pitch > 0 ? '+' : ''}${pitch.toFixed(1)}°` : '--'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider">ROLL DEVIATION:</span>
            <span className="text-base font-semibold text-slate-200 tabular-nums">
              {isConnected ? `${roll > 0 ? '+' : ''}${roll.toFixed(1)}°` : '--'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider">NET DEFLECTION:</span>
            <span
              className={`text-xs font-semibold tabular-nums ${
                !isConnected ? 'text-slate-500' : isElevated ? 'text-[#EF4444]' : 'text-[#10B981]'
              }`}
            >
              {isConnected ? `${totalDeflection.toFixed(2)}°` : '--'}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1F2430] pt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
        <span>SAFE CRITERIA: &lt; {safeLimitDeg}°</span>
        <span className={isElevated && isConnected ? 'text-[#EF4444] font-semibold' : 'text-slate-500'}>
          {isConnected ? (isElevated ? 'THRESHOLD ELEVATED' : 'NOMINAL ALIGNMENT') : 'STANDBY'}
        </span>
      </div>
    </div>
  );
};
