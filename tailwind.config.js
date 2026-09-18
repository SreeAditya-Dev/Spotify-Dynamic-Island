/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          green: "#1DB954",
          light: "#1ed760",
          dark: "#121212",
          gray: "#535353",
          lightgray: "#b3b3b3"
        }
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif"
        ]
      },
      animation: {
        'island-spring': 'springMorph 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave-bar': 'waveBar 1.2s ease-in-out infinite alternate',
      },
      keyframes: {
        springMorph: {
          '0%': { transform: 'scale(0.96)', opacity: '0.85' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        waveBar: {
          '0%': { height: '3px' },
          '100%': { height: '14px' }
        }
      }
    },
  },
  plugins: [],
}
