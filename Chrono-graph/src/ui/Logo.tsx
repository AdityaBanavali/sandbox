import React from 'react'

export interface LogoProps {
  size?: number
  animated?: boolean
  showWordmark?: boolean
  loading?: boolean
  className?: string
}

export const Logo: React.FC<LogoProps> = ({
  size = 48,
  animated = false,
  showWordmark = false,
  loading = false,
  className = '',
}) => {
  // SVG base is drawn in 120x120 viewport
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible flex-shrink-0"
      >
        <defs>
          <filter id="cg-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="cg-cube-top" x1="60" y1="20" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e2246" />
            <stop offset="100%" stopColor="#10132b" />
          </linearGradient>

          <linearGradient id="cg-cube-left" x1="24" y1="40" x2="60" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0c0e1f" />
            <stop offset="100%" stopColor="#060712" />
          </linearGradient>

          <linearGradient id="cg-cube-right" x1="60" y1="40" x2="96" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#171a36" />
            <stop offset="100%" stopColor="#0b0d1e" />
          </linearGradient>

          <linearGradient id="cg-cyan-magenta" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>

          <style>
            {`
              @keyframes cgGlitch {
                0%, 92%, 100% { transform: translate(0, 0); filter: none; }
                93% { transform: translate(-2px, 1px); filter: drop-shadow(2px 0 #22d3ee) drop-shadow(-2px 0 #e879f9); }
                95% { transform: translate(2px, -1px); filter: drop-shadow(-2px 0 #22d3ee) drop-shadow(2px 0 #e879f9); }
                97% { transform: translate(0, 0); filter: none; }
              }
              @keyframes cgOrbit {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes cgClockHour {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes cgClockMinute {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes cgTower1 {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
              }
              @keyframes cgTower2 {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-7px); }
              }
              @keyframes cgTower3 {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
              }

              .cg-animated-root {
                animation: cgGlitch 6s infinite steps(2, end);
              }
              .cg-ring-spin {
                transform-origin: 60px 58px;
                animation: cgOrbit 8s linear infinite;
              }
              .cg-clock-m-spin {
                transform-origin: 60px 40px;
                animation: cgClockMinute ${loading ? '0.8s' : '4s'} linear infinite;
              }
              .cg-clock-h-spin {
                transform-origin: 60px 40px;
                animation: cgClockHour ${loading ? '2.4s' : '16s'} linear infinite;
              }
              .cg-tower-p1 {
                animation: cgTower1 2s ease-in-out infinite;
              }
              .cg-tower-p2 {
                animation: cgTower2 2s ease-in-out 0.35s infinite;
              }
              .cg-tower-p3 {
                animation: cgTower3 2s ease-in-out 0.7s infinite;
              }

              @media (prefers-reduced-motion: reduce) {
                .cg-animated-root,
                .cg-ring-spin,
                .cg-clock-m-spin,
                .cg-clock-h-spin,
                .cg-tower-p1,
                .cg-tower-p2,
                .cg-tower-p3 {
                  animation: none !important;
                }
              }
            `}
          </style>
        </defs>

        <g className={animated ? 'cg-animated-root' : ''}>
          {/* Neon broken orbit ring around cube */}
          <g
            className={animated ? 'cg-ring-spin' : ''}
            style={{ transformOrigin: '60px 58px' }}
          >
            {/* Ellipse rotated into 3D isometric plane */}
            <ellipse
              cx="60"
              cy="58"
              rx="54"
              ry="26"
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeDasharray="14 10 22 8 8 16"
              strokeLinecap="square"
              opacity="0.85"
              filter="url(#cg-neon-glow)"
            />
            <ellipse
              cx="60"
              cy="58"
              rx="54"
              ry="26"
              stroke="#e879f9"
              strokeWidth="1.5"
              strokeDasharray="6 18 10 14"
              strokeDashoffset="12"
              strokeLinecap="square"
              opacity="0.9"
            />
          </g>

          {/* Isometric Voxel Cube base */}
          {/* Left Face */}
          <polygon
            points="24,40 60,60 60,96 24,76"
            fill="url(#cg-cube-left)"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeLinejoin="miter"
          />
          {/* Right Face */}
          <polygon
            points="60,60 96,40 96,76 60,96"
            fill="url(#cg-cube-right)"
            stroke="#e879f9"
            strokeWidth="2"
            strokeLinejoin="miter"
          />
          {/* Top Face (Clock Face Platform) */}
          <polygon
            points="60,20 96,40 60,60 24,40"
            fill="url(#cg-cube-top)"
            stroke="url(#cg-cyan-magenta)"
            strokeWidth="2.5"
            strokeLinejoin="miter"
            filter="url(#cg-neon-glow)"
          />

          {/* Clock Face Details on Isometric Top Plane: Center at (60, 40) */}
          {/* 12 Isometric Clock Ticks */}
          <g stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="square" opacity="0.95">
            {/* 12 o'clock (top vertex dir) */}
            <line x1="60" y1="24" x2="60" y2="28" stroke="#e879f9" strokeWidth="2" />
            {/* 6 o'clock (bottom vertex dir) */}
            <line x1="60" y1="52" x2="60" y2="56" stroke="#e879f9" strokeWidth="2" />
            {/* 3 o'clock (right vertex dir) */}
            <line x1="88" y1="40" x2="82" y2="40" stroke="#e879f9" strokeWidth="2" />
            {/* 9 o'clock (left vertex dir) */}
            <line x1="32" y1="40" x2="38" y2="40" stroke="#e879f9" strokeWidth="2" />

            {/* Other ticks in isometric projection */}
            <line x1="69" y1="28" x2="66" y2="31" />
            <line x1="78" y1="34" x2="74" y2="36" />
            <line x1="78" y1="46" x2="74" y2="44" />
            <line x1="69" y1="52" x2="66" y2="49" />
            <line x1="51" y1="52" x2="54" y2="49" />
            <line x1="42" y1="46" x2="46" y2="44" />
            <line x1="42" y1="34" x2="46" y2="36" />
            <line x1="51" y1="28" x2="54" y2="31" />
          </g>

          {/* Clock Center Pin */}
          <rect x="58.5" y="38.5" width="3" height="3" fill="#ffffff" />

          {/* Hour & Minute Hands */}
          {/* Minute Hand */}
          <g
            className={animated ? 'cg-clock-m-spin' : ''}
            style={{ transformOrigin: '60px 40px' }}
          >
            <line
              x1="60"
              y1="40"
              x2="60"
              y2="28"
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeLinecap="square"
            />
          </g>
          {/* Hour Hand */}
          <g
            className={animated ? 'cg-clock-h-spin' : ''}
            style={{ transformOrigin: '60px 40px' }}
          >
            <line
              x1="60"
              y1="40"
              x2="72"
              y2="40"
              stroke="#e879f9"
              strokeWidth="2.5"
              strokeLinecap="square"
            />
          </g>

          {/* 3 Small Voxel Towers Rising from Cube's Right Side */}
          {/* Tower 1 (Smallest - back) */}
          <g className={animated ? 'cg-tower-p1' : ''}>
            <polygon points="76,34 84,30 84,42 76,46" fill="#131738" stroke="#8b5cf6" strokeWidth="1" />
            <polygon points="84,30 92,34 92,46 84,42" fill="#1e224e" stroke="#8b5cf6" strokeWidth="1" />
            <polygon points="84,26 92,30 84,34 76,30" fill="#a78bfa" stroke="#c4b5fd" strokeWidth="1" />
          </g>

          {/* Tower 2 (Tallest - mid) */}
          <g className={animated ? 'cg-tower-p2' : ''}>
            <polygon points="82,46 90,42 90,62 82,66" fill="#161b44" stroke="#22d3ee" strokeWidth="1" />
            <polygon points="90,42 98,46 98,66 90,62" fill="#1f285c" stroke="#22d3ee" strokeWidth="1" />
            <polygon points="90,34 98,38 90,42 82,38" fill="#22d3ee" stroke="#67e8f9" strokeWidth="1" filter="url(#cg-neon-glow)" />
          </g>

          {/* Tower 3 (Medium - front) */}
          <g className={animated ? 'cg-tower-p3' : ''}>
            <polygon points="68,54 76,50 76,68 68,72" fill="#24143a" stroke="#e879f9" strokeWidth="1" />
            <polygon points="76,50 84,54 84,72 76,68" fill="#381b5c" stroke="#e879f9" strokeWidth="1" />
            <polygon points="76,44 84,48 76,52 68,48" fill="#e879f9" stroke="#f0abfc" strokeWidth="1" filter="url(#cg-neon-glow)" />
          </g>
        </g>
      </svg>

      {/* Retro Synthwave Wordmark */}
      {showWordmark && (
        <div className="flex flex-col select-none">
          <div className="relative font-pixel text-lg sm:text-2xl tracking-widest font-black leading-none">
            {/* Chromatic aberration offset layers */}
            <span
              className="absolute inset-0 text-[#22d3ee] -translate-x-[1.5px] opacity-75 blur-[0.5px] pointer-events-none"
              aria-hidden="true"
            >
              CHRONOGRAPH
            </span>
            <span
              className="absolute inset-0 text-[#e879f9] translate-x-[1.5px] opacity-75 blur-[0.5px] pointer-events-none"
              aria-hidden="true"
            >
              CHRONOGRAPH
            </span>
            <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#22d3ee] via-[#a855f7] to-[#e879f9] filter drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">
              CHRONOGRAPH
            </span>
          </div>
          <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.25em] text-cyan-300/80 uppercase mt-1">
            3D GIT VOXEL ARCHIVE
          </span>
        </div>
      )}
    </div>
  )
}
