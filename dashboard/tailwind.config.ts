import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#C5A572',
          'gold-light': '#D4BA8A',
          'gold-dark': '#A68B5B',
          cream: '#FDF9CF',
          dark: '#20211F',
          surface: '#1A1B19',
          elevated: '#242522',
          hover: '#2D2E2B',
          muted: '#656453',
        },
        bg: {
          DEFAULT: '#0C0D0B',
          surface: '#141513',
          elevated: '#1A1B19',
          hover: '#222320',
        },
        border: {
          DEFAULT: '#2A2B28',
          light: '#3A3B37',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
