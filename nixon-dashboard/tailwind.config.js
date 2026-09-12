/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        cursive: ['"Great Vibes"', 'cursive'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        nav: {
          home: '#5EEAD4',
          tasks: '#93C5FD',
          asks: '#A78BAA',
          chat: '#93C5FD',
          settings: '#F9A8D4',
          text: '#1F2937',
        },
        gradient: {
          cyan: '#0EA5E9',
          indigo: '#6366F1',
          purple: '#A855F7',
          pink: '#EC4899',
        },
        brain: {
          base: '#22D3EE',
          glow: '#EC4899',
        },
      },
    },
  },
  plugins: [],
}
