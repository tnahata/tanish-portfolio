import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0a0e27',
        'primary-dark': '#0f1419',
        accent: '#00d9ff',
        secondary: '#6366f1',
        text: '#f5f5f5',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
