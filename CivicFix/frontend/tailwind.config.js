/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#061729',
          900: '#0B2A4A',
          800: '#133D6B',
          700: '#1C528D',
          600: '#2668B0',
          50: '#F0F6FC',
        },
        saffron: {
          DEFAULT: '#E8890C',
          light: '#F59E28',
          dark: '#C27005',
          50: '#FFF8ED',
        },
      },
    },
  },
  plugins: [],
}
