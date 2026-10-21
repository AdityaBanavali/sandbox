/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        telemetry: {
          darkest: '#090A0F',
          panel: '#111318',
          card: '#161922',
          border: '#1F2430',
          muted: '#64748B',
          nominal: '#10B981',
          resonance: '#F59E0B',
          hazard: '#EF4444',
          cyan: '#38BDF8'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'Geist', 'system-ui', '-apple-system', 'sans-serif']
      }
    },
  },
  plugins: [],
}
