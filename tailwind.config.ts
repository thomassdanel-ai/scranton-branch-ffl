import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // === Bento HUD — 2025 aurora-on-black ===
        // Legacy names kept for backwards compat with existing components.
        primary: {
          DEFAULT: '#E056FF',  // aurora magenta
          dark: '#9D7FFF',     // violet
        },
        bg: {
          primary: '#08080A',    // page
          secondary: '#131318',  // card/panel
          tertiary: '#1D1D23',   // elevated / input
        },
        accent: {
          green: '#CCFF56',   // aurora lime
          red: '#FF86D0',     // aurora pink (soft danger)
          gold: '#CCFF56',    // lime as emphasis (was gold)
          purple: '#9D7FFF',  // aurora violet
        },
        league: {
          sales: '#E056FF',      // magenta
          accounting: '#56F0FF', // cyan
        },
        text: {
          primary: '#FAFAFA',
          secondary: '#8C8C99',
          muted: '#54545E',
        },
        // New aurora tokens
        aurora: {
          magenta: '#E056FF',
          cyan: '#56F0FF',
          lime: '#CCFF56',
          violet: '#9D7FFF',
          pink: '#FF86D0',
        },
        hairline: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          strong: 'rgba(255, 255, 255, 0.16)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Bricolage Grotesque', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Onest', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // Finer type scale for display use
        'display-xs': ['2.5rem', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-sm': ['3.5rem', { lineHeight: '0.92', letterSpacing: '-0.035em' }],
        'display-md': ['4.5rem', { lineHeight: '0.9', letterSpacing: '-0.04em' }],
        'display-lg': ['6rem', { lineHeight: '0.88', letterSpacing: '-0.04em' }],
        'display-xl': ['9rem', { lineHeight: '0.85', letterSpacing: '-0.05em' }],
      },
      backgroundImage: {
        'aurora-gradient': 'linear-gradient(110deg, #E056FF 0%, #56F0FF 45%, #CCFF56 90%)',
        'aurora-gradient-soft': 'linear-gradient(110deg, rgba(224,86,255,0.8) 0%, rgba(86,240,255,0.8) 45%, rgba(204,255,86,0.8) 90%)',
        'surface-gradient': 'linear-gradient(135deg, rgba(29,29,35,0.85), rgba(19,19,24,0.9))',
      },
      boxShadow: {
        'aurora-mag': '0 0 40px -10px rgba(224, 86, 255, 0.4)',
        'aurora-cyan': '0 0 40px -10px rgba(86, 240, 255, 0.4)',
        'aurora-lime': '0 0 40px -10px rgba(204, 255, 86, 0.4)',
        'panel': '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px -12px rgba(0,0,0,0.6)',
      },
      animation: {
        'drift-1': 'drift1 18s ease-in-out infinite',
        'drift-2': 'drift2 22s ease-in-out infinite',
        'drift-3': 'drift3 26s ease-in-out infinite',
        'drift-4': 'drift4 20s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-up': 'fadeUp 0.5s ease-out',
      },
      keyframes: {
        drift1: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%':      { transform: 'translate(80px, 120px) scale(1.1)' },
        },
        drift2: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%':      { transform: 'translate(-100px, 60px) scale(0.9)' },
        },
        drift3: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%':      { transform: 'translate(120px, -80px) scale(1.15)' },
        },
        drift4: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%':      { transform: 'translate(-60px, -40px) scale(1.05)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
