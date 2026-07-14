import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables so the admin-selected theme re-skins the whole
        // storefront at runtime (see :root in globals.css + <html> vars in layout).
        ink: 'rgb(var(--ink) / <alpha-value>)',
        cream: 'rgb(var(--cream) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          dark: 'rgb(var(--accent-dark) / <alpha-value>)',
          light: 'rgb(var(--accent-light) / <alpha-value>)',
        },
        sale: 'rgb(var(--sale) / <alpha-value>)',
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
