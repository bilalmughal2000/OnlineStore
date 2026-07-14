import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: '#b45309', dark: '#92400e' }, ink: '#1c1917' },
    },
  },
  plugins: [typography],
};
