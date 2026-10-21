import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// 1200x630 Social Graph Banner
const ogSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="#080918"/>
      <stop offset="50%" stopColor="#0a0a20"/>
      <stop offset="100%" stopColor="#04050d"/>
    </linearGradient>

    <linearGradient id="neon-cyan-pink" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="#22d3ee"/>
      <stop offset="50%" stopColor="#a855f7"/>
      <stop offset="100%" stopColor="#e879f9"/>
    </linearGradient>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(34,211,238,0.08)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg-grad)"/>

  <!-- Retro Grid Horizon -->
  <rect x="0" y="240" width="1200" height="390" fill="url(#grid)" opacity="0.8"/>
  <line x1="0" y1="240" x2="1200" y2="240" stroke="rgba(232,121,249,0.3)" stroke-width="2"/>

  <!-- Distant City Skyline Silhouettes -->
  <g fill="#0e1233" opacity="0.6">
    <rect x="100" y="160" width="40" height="80"/>
    <rect x="150" y="120" width="55" height="120"/>
    <rect x="220" y="180" width="35" height="60"/>
    <rect x="270" y="100" width="60" height="140"/>
    <rect x="340" y="150" width="45" height="90"/>
    <rect x="850" y="140" width="50" height="100"/>
    <rect x="910" y="90" width="65" height="150"/>
    <rect x="990" y="130" width="45" height="110"/>
    <rect x="1050" y="170" width="70" height="70"/>
  </g>

  <!-- Neon Horizon Glow -->
  <circle cx="600" cy="240" r="320" fill="rgba(168,85,247,0.12)" filter="url(#glow)"/>

  <!-- Central Cube / Logo Element (Scale 2.4x at (600, 260)) -->
  <g transform="translate(470, 100) scale(2.2)">
    <!-- Broken orbit ring -->
    <ellipse cx="60" cy="58" rx="54" ry="26" stroke="#22d3ee" stroke-width="2.5" stroke-dasharray="14 10 22 8 8 16" opacity="0.8" filter="url(#glow)"/>
    <ellipse cx="60" cy="58" rx="54" ry="26" stroke="#e879f9" stroke-width="1.5" stroke-dasharray="6 18 10 14" opacity="0.85"/>

    <!-- Left Face -->
    <polygon points="24,40 60,60 60,96 24,76" fill="#0d1029" stroke="#22d3ee" stroke-width="2"/>
    <!-- Right Face -->
    <polygon points="60,60 96,40 96,76 60,96" fill="#181c42" stroke="#e879f9" stroke-width="2"/>
    <!-- Top Face -->
    <polygon points="60,20 96,40 60,60 24,40" fill="#202657" stroke="url(#neon-cyan-pink)" stroke-width="2.5" filter="url(#glow)"/>

    <!-- 12 Ticks -->
    <line x1="60" y1="24" x2="60" y2="28" stroke="#e879f9" stroke-width="2"/>
    <line x1="60" y1="52" x2="60" y2="56" stroke="#e879f9" stroke-width="2"/>
    <line x1="88" y1="40" x2="82" y2="40" stroke="#e879f9" stroke-width="2"/>
    <line x1="32" y1="40" x2="38" y2="40" stroke="#e879f9" stroke-width="2"/>

    <!-- Hands -->
    <line x1="60" y1="40" x2="60" y2="28" stroke="#22d3ee" stroke-width="2.5"/>
    <line x1="60" y1="40" x2="72" y2="40" stroke="#e879f9" stroke-width="2.5"/>

    <!-- Towers -->
    <g>
      <polygon points="84,26 92,30 84,34 76,30" fill="#a78bfa" stroke="#c4b5fd" stroke-width="1"/>
      <polygon points="90,34 98,38 90,42 82,38" fill="#22d3ee" stroke="#67e8f9" stroke-width="1" filter="url(#glow)"/>
      <polygon points="76,44 84,48 76,52 68,48" fill="#e879f9" stroke="#f0abfc" stroke-width="1" filter="url(#glow)"/>
    </g>
  </g>

  <!-- Title / Typography -->
  <!-- Tagline Pill -->
  <g transform="translate(600, 395)">
    <rect x="-160" y="-18" width="320" height="36" rx="18" fill="rgba(34,211,238,0.12)" stroke="rgba(34,211,238,0.5)" stroke-width="1.5"/>
    <text x="0" y="5" font-family="'Courier New', monospace" font-size="14" font-weight="bold" fill="#22d3ee" text-anchor="middle" letter-spacing="3">
      3D RETRO GIT VISUALIZER
    </text>
  </g>

  <!-- Big Title -->
  <text x="600" y="470" font-family="'Arial Black', sans-serif" font-size="64" font-weight="900" fill="url(#neon-cyan-pink)" text-anchor="middle" letter-spacing="8" filter="url(#glow)">
    CHRONOGRAPH
  </text>

  <!-- Subtitle Tagline -->
  <text x="600" y="525" font-family="'Courier New', monospace" font-size="24" font-weight="bold" fill="#cbd5e1" text-anchor="middle" letter-spacing="1">
    Watch any git repo grow into a neon voxel city
  </text>

  <!-- Feature Pills -->
  <g transform="translate(600, 575)" font-family="'Courier New', monospace" font-size="13" fill="#94a3b8" text-anchor="middle">
    <text x="0" y="0">
      ⚡ Client-Side WebGL  •  🎮 Procedural 8-Bit Avatars  •  🎥 1080p Video Export
    </text>
  </g>
</svg>
`

async function generateOGImage() {
  console.log('Generating public/og-image.png (1200x630)...')
  await sharp(Buffer.from(ogSvg))
    .png()
    .toFile(path.join(rootDir, 'public', 'og-image.png'))
  console.log('og-image.png created.')
}

generateOGImage().catch((err) => {
  console.error(err)
  process.exit(1)
})
