/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#0a0e14",
          surface: "#0e141d",
          elevated: "#141c28",
          border: "#1f2c3f",
          borderLight: "#2e405b",
          cyan: "#00f0ff",
          green: "#00ff88",
          amber: "#ffb800",
          red: "#ff003c",
          redGlow: "#ff1744",
          muted: "#7d8b99",
          text: "#e6edf3",
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      animation: {
        'alert-flash': 'alertFlash 1.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        alertFlash: {
          '0%': { backgroundColor: 'rgba(255, 0, 60, 0.35)', borderColor: '#ff003c', boxShadow: '0 0 25px rgba(255,0,60,0.6)' },
          '100%': { backgroundColor: 'transparent', borderColor: 'inherit', boxShadow: 'none' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 240, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 240, 255, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
