import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a73e8',
          dark: '#0d47a1',
        },
        bg: {
          primary: '#0a0e17',
          secondary: '#111827',
          tertiary: '#1f2937',
        },
        accent: {
          green: '#10b981',
          red: '#ef4444',
          gold: '#f59e0b',
          purple: '#8b5cf6',
        },
        league: {
          sales: '#3b82f6',
          accounting: '#10b981',
        },
        text: {
          primary: '#f9fafb',
          secondary: '#9ca3af',
          muted: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
