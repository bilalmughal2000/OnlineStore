import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral base + one strong accent (terracotta) per the design direction.
        ink: '#1c1917',
        cream: '#faf7f2',
        accent: {
          DEFAULT: '#b45309',
          dark: '#92400e',
          light: '#f59e0b',
        },
        sale: '#be123c',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      container: {
        center: true,
        padding: '1rem',
        screens: { '2xl': '1280px' },
      },
    },
  },
  plugins: [typography],
};

export default config;
